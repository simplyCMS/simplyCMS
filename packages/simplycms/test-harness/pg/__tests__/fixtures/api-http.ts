// Спільне для інтеграційних тестів HTTP-адаптера (М1, Task 7): виклик
// `handleApiRequest` без мережі. Сесію Better Auth підміняє тест-файл
// (`vi.mock('simplycms/auth')` мусить бути в самому файлі — hoisting), решта
// шляху (ролі токена, grants, виконавець, ідемпотентність) справжня.
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { CORE_OPERATIONS, getOperation } from 'simplycms/admin-server/impl';
import { defineOperation } from 'simplycms/operations';
import {
  handleApiRequest,
  handleOpenApiRequest,
} from 'simplycms/operations/server';

/** Операція-свідок: повертає GUC актора, під яким реально йшла транзакція. */
const whoami = defineOperation({
  id: 'test.whoami',
  permission: 'settings.manage',
  input: z.object({}),
  output: z.object({ userId: z.string().nullable() }),
  async run({ db }) {
    const r = await db.execute<{ u: string }>(
      sql`select current_setting('app.user_id', true) as u`,
    );
    return { userId: r.rows[0]?.u || null };
  },
});

/** Пише рядок і повертає вихід НЕ за схемою: рядок мусить відкотитись разом з 500. */
const badOutput = defineOperation({
  id: 'test.badOutput',
  permission: 'settings.manage',
  input: z.object({ key: z.string() }),
  output: z.object({ ok: z.boolean() }),
  async run({ db }, input) {
    await db.execute(
      sql`insert into public.system_settings (id, key, value) values (gen_random_uuid(), ${input.key}, '{}'::jsonb)`,
    );
    return { ok: 'не boolean' } as never;
  },
});

const lookup = (id: string) =>
  id === 'test.whoami'
    ? whoami
    : id === 'test.badOutput'
      ? badOutput
      : getOperation(id);

export function apiHarness(sessions: Map<string, unknown>) {
  return {
    /** `GET /api/v1/openapi.json` (або інший метод) з довільними заголовками. */
    openapi: (
      headers: Record<string, string> = {},
      method = 'GET',
    ): Promise<Response> =>
      handleOpenApiRequest(
        new Request('https://shop.test/api/v1/openapi.json', {
          method,
          headers,
        }),
        CORE_OPERATIONS,
      ),
    /** `POST /api/v1/<op>` з JSON-тілом; сесія — заголовком `x-test-session`. */
    call: (
      op: string,
      body: unknown,
      headers: Record<string, string> = {},
    ): Promise<Response> =>
      handleApiRequest(
        new Request(`https://shop.test/api/v1/${op}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...headers },
          body: JSON.stringify(body),
        }),
        op,
        lookup,
      ),
    /** Реєструє сесійного суб'єкта під ключем (значення `x-test-session`). */
    sessionAs: (
      key: string,
      userId: string,
      roles: ('admin' | 'user')[] = ['admin'],
    ) =>
      sessions.set(key, {
        userId,
        email: `${userId}@x.test`,
        name: null,
        roles,
      }),
  };
}
