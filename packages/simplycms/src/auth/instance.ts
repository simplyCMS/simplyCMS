import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { resolveDriverEnv } from 'simplycms/env';
import type { MailTransport, scheduleMail } from 'simplycms/mail';
import { accounts, sessions, users, verifications } from 'simplycms/schema';
import {
  createSessionBanHook,
  isUserBannedInDb,
  type IsUserBanned,
} from './ban';
import { createAuthDb } from './drizzle-proxy';
import {
  assertAuthBaseUrl,
  resolveAuthBaseUrl,
  resolveAuthSecret,
} from './auth-env';
import { createUserCreateHook, type ProvisionUser } from './hooks';
import { provisionUserInDb } from './provision';
import { createResetPasswordSender } from './reset-mail';
import { isResetStillValid, type ResetGuard } from './reset-guard';
import { createVerificationSender } from './verification-mail';

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
  /**
   * Вимагати підтвердження пошти (Р30). За замовчуванням — `true` лише з SMTP:
   * з драйвером `log` лист нікуди не дійде, і реєстрація в dev ламалась би.
   */
  readonly requireEmailVerification?: boolean;
  /** Назва магазину в листі. За замовчуванням — з профілю магазину в БД. */
  readonly storeName?: string;
}

/**
 * Створює інстанс. Env читається ТУТ, у рантаймі — не на модуль-рівні.
 */
export function createAuth(deps: AuthDeps = {}) {
  const resetGuard = deps.resetGuard ?? isResetStillValid;
  const requireEmailVerification =
    deps.requireEmailVerification ??
    resolveDriverEnv(process.env).mail.driver === 'smtp';
  // `auth` ще не існує в момент побудови конфігу, а хук скидання пароля
  // потребує його контексту: міст через замикання замість циклічного типу.
  const verifier: { mark?: (userId: string) => Promise<void> } = {};
  const mailDeps = {
    schedule: deps.schedule,
    mailTransport: deps.mailTransport,
    storeName: deps.storeName,
  };
  // Порожній чи некоректний `deps.baseURL` — гучна відмова з імʼям поля, а не
  // гола `TypeError` від `new URL` нижче.
  const baseURL =
    deps.baseURL === undefined
      ? resolveAuthBaseUrl(process.env)
      : assertAuthBaseUrl(deps.baseURL, 'AuthDeps.baseURL');

  const auth = betterAuth({
    secret: deps.secret ?? resolveAuthSecret(process.env),
    // 🔴 Р18а: база посилань і trustedOrigins — ЗАВЖДИ з env (`BETTER_AUTH_URL`
    // або origin `VITE_SITE_URL`); без обох resolveAuthBaseUrl падає. Без бази
    // BA брав би їх із `request.url`, і підроблений `Host`/`X-Forwarded-Host`
    // отруював би посилання скидання пароля.
    baseURL,
    trustedOrigins: [new URL(baseURL).origin],
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
      // 🔴 Р30: без підтвердження пошти signUp одразу дає сесію, і чужу пошту
      // можна зайняти до справжнього власника (pre-hijack).
      requireEmailVerification,
      // 🔴 Р19: скидання пароля (і прийняття запрошення — воно йде тим самим
      // `resetPassword`) гасить усі сесії користувача. Без цього сесія, що
      // вже була в зловмисника, переживала б зміну пароля.
      revokeSessionsOnPasswordReset: true,
      // Перехід за посиланням зі скриньки — такий самий доказ володіння
      // поштою, як і лист підтвердження (Р30).
      onPasswordReset: async ({ user }) => {
        if (!user.emailVerified) await verifier.mark?.(user.id);
      },
      sendResetPassword: createResetPasswordSender({ resetGuard, ...mailDeps }),
    },
    emailVerification: {
      // Непідтверджений акаунт (пошту змінив адмін, акаунт створено до SMTP)
      // отримує новий лист на спробу входу.
      sendOnSignIn: true,
      sendVerificationEmail: createVerificationSender(mailDeps),
    },
    advanced: {
      // Явно, а не за замовчуванням BA: інакше `isTest()` мовчки вимикає
      // перевірку origin/redirectTo у Vitest, і trustedOrigins лишається без
      // негативного контролю.
      disableOriginCheck: false,
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
  verifier.mark = async (userId) => {
    const context = await auth.$context;
    await context.internalAdapter.updateUser(userId, { emailVerified: true });
  };
  return auth;
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
