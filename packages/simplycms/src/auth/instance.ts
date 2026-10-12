import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { withActor } from 'simplycms/db';
import { createTranslator } from 'simplycms/i18n';
import {
  deliverMail,
  renderPasswordResetMail,
  scheduleMail,
  type MailTransport,
} from 'simplycms/mail';
import { accounts, sessions, users, verifications } from 'simplycms/schema';
import { getStoreLocale, readStoreProfile } from 'simplycms/site';
import {
  createSessionBanHook,
  isUserBannedInDb,
  type IsUserBanned,
} from './ban';
import { createAuthDb } from './drizzle-proxy';
import { resolveAuthBaseUrl, resolveAuthSecret } from './auth-env';
import { createUserCreateHook, type ProvisionUser } from './hooks';
import { provisionUserInDb } from './provision';
import { isResetStillValid, type ResetGuard } from './reset-guard';

/**
 * Інстанс Better Auth серверного контуру v2 (B3′, Task 7).
 *
 * 🔴 Контур підключений до `start.ts`/роутів (К1′б) — GoTrue знесено
 * повністю, це ЄДИНИЙ auth-флоу магазину.
 *
 * 🔴 Плагінів — нуль (B3: CVE-поверхня). Кожен плагін BA додає роути й
 * таблиці; ставити їх «про запас» означає розширювати поверхню атаки на
 * функціональність, якою ніхто не користується.
 */

/** Схема, яку бачить адаптер. Ключі — імена МОДЕЛЕЙ (див. `usePlural`). */
const authSchema = { users, sessions, accounts, verifications };

/** Що можна підмінити ззовні — рівно стільки, скільки треба тестам. */
export interface AuthDeps {
  /**
   * DB-адаптер Better Auth. За замовчуванням — drizzle над pg-proxy через
   * `withActor`. Юніт-тести підставляють `better-auth/adapters/memory` — саме
   * цим DoD спеки «BA тестується без Docker» виконується фактом.
   */
  readonly database?: Parameters<typeof betterAuth>[0]['database'];
  /** Провізія `profiles`+`user_roles`. За замовчуванням — запис у Postgres. */
  readonly provisionUser?: ProvisionUser;
  /** Чи забанений користувач (Е6г-13). За замовчуванням — читання `users.banned_at`. */
  readonly isUserBanned?: IsUserBanned;
  /** Guard скидання пароля (Е6г-18). За замовчуванням — `FOR SHARE` по `users`. */
  readonly resetGuard?: ResetGuard;
  readonly secret?: string;
  readonly baseURL?: string;
  /** Постановка листа в outbox. За замовчуванням — `scheduleMail` (власна транзакція). */
  readonly schedule?: typeof scheduleMail;
  /** Транспорт порту пошти. За замовчуванням — `getMailTransport()` за env. */
  readonly mailTransport?: MailTransport;
  /** Назва магазину в листі. За замовчуванням — з профілю магазину в БД. */
  readonly storeName?: string;
}

/** `profile.name || 'SimplyCMS'` — той самий фолбек, що й в owner:invite. */
const readStoreName = (): Promise<string> =>
  withActor({ role: 'app_admin' }, readStoreProfile).then(
    (profile) => profile.name || 'SimplyCMS',
  );

/** Помилка фонової доставки без секретів: лише клас помилки, без тексту. */
const logDeliveryFailure = (error: unknown): void => {
  console.warn(
    '[simplycms/auth] фонова доставка листа скидання пароля не вдалась:',
    error instanceof Error ? error.name : typeof error,
  );
};

/** Явний origin: `baseURL` для посилань і єдиний довірений origin. */
function authBase(baseURL: string | undefined) {
  if (!baseURL) return {};
  return { baseURL, trustedOrigins: [new URL(baseURL).origin] };
}

/**
 * Створює інстанс. Env читається ТУТ, у рантаймі — не на модуль-рівні.
 */
export function createAuth(deps: AuthDeps = {}) {
  const schedule = deps.schedule ?? scheduleMail;
  const resetGuard = deps.resetGuard ?? isResetStillValid;

  return betterAuth({
    secret: deps.secret ?? resolveAuthSecret(process.env),
    // 🔴 Р18а: база посилань і trustedOrigins — ЗАВЖДИ з env (`BETTER_AUTH_URL`
    // або `VITE_SITE_URL`). Без цього BA бере їх із `request.url`, і підроблений
    // `Host`/`X-Forwarded-Host` отруює посилання скидання пароля.
    ...authBase(deps.baseURL ?? resolveAuthBaseUrl(process.env)),
    database:
      deps.database ??
      drizzleAdapter(createAuthDb(), {
        provider: 'pg',
        schema: authSchema,
        // 🔴 Обовʼязково: наші таблиці названі в МНОЖИНІ (узгоджено з доменною
        // схемою), а BA за замовчуванням шукає `user`/`session` — без цього
        // прапорця адаптер падає на першому ж запиті.
        usePlural: true,
      }),
    emailAndPassword: {
      enabled: true,
      sendResetPassword: async ({ user, url, token }) => {
        // Токен BA уже вставив окремим запитом: якщо email змінився або
        // акаунт видалено між пошуком і вставкою, guard його прибирає (Е6г-18).
        if (!(await resetGuard(user.id, user.email, token))) return;
        const message = renderPasswordResetMail({
          to: user.email,
          url,
          storeName: deps.storeName ?? (await readStoreName()),
          t: createTranslator(getStoreLocale()),
        });
        // Швидкий запис у БД — лист у черзі, далі доставка БЕЗ await (Е8-О1):
        // BA кличе колбек лише для наявного email, і затримка SMTP у відповіді
        // видала б існування акаунта за часом відповіді. Збій доставки лишає
        // рядок в outbox — його добере наступна доставка.
        const ids = await schedule([{ kind: 'password_reset', message }]);
        void deliverMail(ids, deps.mailTransport).catch(logDeliveryFailure);
      },
    },
    advanced: {
      database: {
        // 🔴 `'uuid'` — єдине значення, коректне для ОБОХ адаптерів. Драйвер
        // drizzle-pg оголошує `supportsUUIDs`, тож id генерує сама БД
        // (`gen_random_uuid()` дефолтом колонки, як описано в `schema/auth`);
        // memory-адаптер UUID не підтримує, і BA згенерує його в JS. Значення
        // `false` зламало б саме memory-контур — користувач лишався б без id.
        generateId: 'uuid',
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: createUserCreateHook(deps.provisionUser ?? provisionUserInDb),
        },
      },
      session: {
        create: {
          before: createSessionBanHook(deps.isUserBanned ?? isUserBannedInDb),
        },
      },
    },
  });
}

/** Тип готового інстансу — для сигнатур споживачів К1′б. */
export type SimplyAuth = ReturnType<typeof createAuth>;

let instance: SimplyAuth | undefined;

/**
 * Інстанс процесу (лінива синглтон-фабрика) — той самий контракт «рестарт
 * замість гарячої ротації», що й у пулу `simplycms/db`.
 */
export function getAuth(): SimplyAuth {
  instance ??= createAuth();
  return instance;
}

/** Скидає синглтон (teardown тестів, перемикання env). */
export function resetAuth(): void {
  instance = undefined;
}
