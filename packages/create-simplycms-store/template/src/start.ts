import {
  createStart,
  createMiddleware,
  createIsomorphicFn,
} from '@tanstack/react-start';
import { createSerializationAdapter, redirect } from '@tanstack/react-router';
import { readSessionSubject } from 'simplycms/auth';
import { domainErrorAdapter } from 'simplycms/runtime/domain-error-adapter';
import { csrfMiddleware } from 'simplycms/runtime/csrf';
import { bodyLimitMiddleware } from 'simplycms/runtime/body-limit';
import {
  isMaskableError,
  maskAround,
  toMaskedPayload,
} from 'simplycms/server-guard';

/**
 * Чи веде шлях в адмінку. Винесено окремо, щоб межа роздiлу «що охороняємо»
 * перевірялася юнітом без підйому Start-міддлвари.
 */
export function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

/**
 * Server-side guard для початкового запиту на `/admin`.
 *
 * Admin shell повністю client-only (`ssr: false`), тому його `beforeLoad`
 * виконується лише на клієнті після гідрації. Цей request middleware закриває
 * прогалину: він редиректить незалогінених / не-admin користувачів ще до рендеру
 * shell на першому HTTP-запиті.
 *
 * `/profile` тут НЕ перевіряється — `_protected` SSR-роут уже захищений серверним
 * `beforeLoad` (не дублюємо guard).
 *
 * 🔴 Контур — Better Auth (К1′б), GoTrue тут більше немає. Перевірки
 * «чи готовий env» теж немає навмисно: `readSessionSubject` читає
 * `BETTER_AUTH_SECRET`/`DATABASE_URL` через штатний контракт серверного env і
 * на відсутньому ключі падає ГУЧНО. Стара гілка «немає env — пропускаємо»
 * була fail-open: неповний деплой мовчки відкривав адмінку.
 */
const adminRequestGuard = createMiddleware().server(
  async ({ next, request }) => {
    const { pathname } = new URL(request.url);

    if (isAdminPath(pathname)) {
      // Заголовки беремо з `request` напряму — не залежимо від ALS.
      const subject = await readSessionSubject(request.headers);

      // Дві різні відмови: гостю показуємо вхід, залогіненому без ролі —
      // вітрину. Один спільний редірект відправляв би адміна, що вже
      // увійшов, на форму входу, з якої той одразу вилітав би назад.
      if (!subject) throw redirect({ to: '/auth' });
      if (!subject.roles.includes('admin')) throw redirect({ to: '/' });
    }

    return next();
  },
);

/**
 * Р23: непередбачена помилка server function не доходить до клієнта з текстом
 * Postgres (`Failed query … params`) чи `connect ECONNREFUSED host:port`.
 * Глобальна function-middleware стоїть ПЕРШОЮ в ланцюгу, тож `next()` кидає
 * помилку будь-якого рівня (валідатор, обробник, внутрішні міддлвари) — і ту
 * саму помилку, яку SSR-лоадер отримує від server function у процесі. Логіка
 * (прод-предикат, ідентифікатор, лог через `redactUrls`, пропуск доменних
 * помилок і керування потоком Start) — у ядрі; тут лише склейка.
 */
const maskUnexpectedErrors = createMiddleware({ type: 'function' }).server(
  ({ next }) => maskAround(next),
);

/**
 * Р23, канал SSR: помилка лоадера чи `beforeLoad`, кинута НЕ через server
 * function, потрапляла б у payload дегідратації як є. Адаптери `createStart`
 * йдуть у router-core ПЕРЕД `ShallowErrorPlugin` (а `domainErrorAdapter` — перед
 * цим), тож сюди доходять лише непередбачені помилки. Серверна половина —
 * `createIsomorphicFn().server(...)`: server-only ядро в клієнтський бандл не
 * потрапляє, а клієнт нічого не маскує (`test` → `false`) і лише відновлює
 * `Error` із замаскованим повідомленням.
 */
const isMaskable = createIsomorphicFn()
  .server((value: unknown) => isMaskableError(value))
  .client((): boolean => false);
const maskedPayload = createIsomorphicFn()
  .server((error: Error) => toMaskedPayload(error))
  .client((error: Error) => ({ message: error.message }));

const maskedErrorAdapter = createSerializationAdapter({
  key: 'simplycms-masked-error',
  test: (value): value is Error => isMaskable(value),
  toSerializable: (error: Error) => maskedPayload(error),
  fromSerializable: (value: { readonly message: string }) =>
    new Error(value.message),
});

// UPSTREAM:START-2 — docs/architecture/upstream-workarounds.md
/**
 * `serializationAdapters` (Е3-20): без нього `@tanstack/router-core`'s
 * `ShallowErrorPlugin` серіалізує доменні помилки (`AdminConflictError`,
 * `AuthzError`) голим `.message` — клієнт не бачить `name`/`kind`/
 * `constraint`/`operation`, і адмінка показує технічний текст замість
 * тосту з i18n-ключем. Адаптер — client-safe (`simplycms/runtime`), не
 * server-only.
 */
/**
 * 🔴 CSRF першим (до читання сесії в adminRequestGuard). Дефолтний захист
 * Start вмикається лише БЕЗ `startInstance`, тож тут він явний: без нього
 * server functions і POST-роути приймали б міжсайтові запити. Виняток —
 * `CSRF_EXEMPT_PREFIXES` у `simplycms/runtime/csrf` (Better Auth).
 * Далі стеля тіла (`bodyLimitMiddleware`, К3-Е6д-2): відмова за `Content-Length`
 * до читання сесії й до `formData()` обробника server function.
 */
export const startInstance = createStart(() => ({
  serializationAdapters: [domainErrorAdapter, maskedErrorAdapter],
  functionMiddleware: [maskUnexpectedErrors],
  requestMiddleware: [csrfMiddleware, bodyLimitMiddleware, adminRequestGuard],
}));
