import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { accounts, sessions, users, verifications } from 'simplycms/schema';
import { createAuthDb } from './drizzle-proxy';
import { resolveAuthBaseUrl, resolveAuthSecret } from './env';
import { createUserCreateHook, type ProvisionUser } from './hooks';
import { renderResetPasswordEmail } from './invite-email';
import { provisionUserInDb } from './provision';
import { stubSendAuthEmail, type SendAuthEmail } from './send-email';

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
  readonly secret?: string;
  readonly baseURL?: string;
  /**
   * Канал доставки листів. За замовчуванням — заглушка з логом
   * (`./send-email`): SMTP лишається справою магазину, ядро лише КЛИЧЕ канал.
   */
  readonly sendEmail?: SendAuthEmail;
  /** Назва магазину в темі листа. */
  readonly storeName?: string;
}

/**
 * Створює інстанс. Env читається ТУТ, у рантаймі — не на модуль-рівні.
 */
export function createAuth(deps: AuthDeps = {}) {
  const sendEmail = deps.sendEmail ?? stubSendAuthEmail;
  const storeName = deps.storeName ?? 'SimplyCMS';

  return betterAuth({
    secret: deps.secret ?? resolveAuthSecret(process.env),
    baseURL: deps.baseURL ?? resolveAuthBaseUrl(process.env),
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
      // 🔴 Колбек прибіндований ЗАВЖДИ, навіть коли транспорт — заглушка.
      // Інакше `requestPasswordReset` мовчки повертав би 200 без жодного
      // сліду, і «лист не прийшов» неможливо було б відрізнити від
      // «магазин не налаштував пошту».
      sendResetPassword: async ({ user, url }) => {
        await sendEmail(
          renderResetPasswordEmail({ to: user.email, url, storeName }),
        );
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
