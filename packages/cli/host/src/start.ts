import { createStart, createMiddleware } from '@tanstack/react-start';
import { redirect } from '@tanstack/react-router';
import { readSessionSubject } from 'simplycms/auth';

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

export const startInstance = createStart(() => ({
  requestMiddleware: [adminRequestGuard],
}));
