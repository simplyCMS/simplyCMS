// М1 Task 4 (І4, І5 майстра): кожна перекладна сутність має на COMMIT рядок
// основної мови з непорожніми обовʼязковими полями. Доводиться на одноразових
// probe-таблицях (продуктові підключає Task 17) і під ОБОМА писарями каталогу.
//
// 🔴 Відкладений тригер стріляє на COMMIT, тож кожен кейс іде через `withActor`
// (BEGIN → set_config → SET LOCAL ROLE → … → COMMIT): відмову кидає саме
// `commit`. Що функція читає під правами актора, а не власника, фіксує окремий
// кейс «права актора» (власник забирає SELECT → commit дає 42501): решта кейсів
// пройшла б і під власником.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveHarness } from '../up.mjs';
import {
  applyCanon,
  createTempDatabase,
  dropTempDatabase,
  queryRows,
  randomDbName,
  withDbName,
  withUser,
} from '../apply.mjs';
import { withActor } from '../actors.mjs';
import {
  deleteBase,
  deleteTranslation,
  insertBase as base,
  insertTranslation as tr,
  installProbeSet,
  updateTranslations as upd,
  type TranslatableProbe,
} from './fixtures/translatable-probe';

const ACTORS = {
  app_user: {
    userId: '11111111-1111-4111-8111-111111111111',
    role: 'app_user',
  },
  app_admin: {
    userId: '33333333-3333-4333-8333-333333333333',
    role: 'app_admin',
  },
};
const REFUSED = { code: '23514' }; // check_violation

describe.each(Object.entries(ACTORS))(
  'БД: обовʼязковий рядок основної мови під %s (І4, І5)',
  (_name, actor) => {
    let harness: { url: string; teardown: () => Promise<void> };
    const dbName = randomDbName('simplycms_source_translation');
    let dbUrl: string;
    let runtimeUrl: string;
    let main: TranslatableProbe;
    let cond: TranslatableProbe;
    let quoted: TranslatableProbe;
    let multi: TranslatableProbe;

    const run = (...sql: string[]) => withActor(runtimeUrl, actor, sql);
    /** Сутність, що вже в БД: база + основна й англійська мови. */
    const seed = async (p: TranslatableProbe = main, id = randomUUID()) => {
      await run(base(p, id), tr(p, id, 'uk', 'Назва'), tr(p, id, 'en', 'Name'));
      return id;
    };
    const count = async (p: TranslatableProbe, id: string) =>
      (
        await queryRows(
          dbUrl,
          `select count(*)::int as n from public.${p.baseSql} where id = $1`,
          [id],
        )
      )[0].n;

    beforeAll(async () => {
      harness = await resolveHarness();
      await createTempDatabase(harness.url, dbName);
      dbUrl = withDbName(harness.url, dbName);
      await applyCanon(dbUrl);
      runtimeUrl = withUser(dbUrl, 'app_runtime');
      ({ main, cond, quoted, multi } = await installProbeSet(dbUrl));
    }, 120_000);

    afterAll(async () => {
      if (dbUrl) await dropTempDatabase(harness.url, dbName);
      await harness?.teardown();
    });

    it('база без перекладу основною мовою — відмова на коміті', async () => {
      const id = randomUUID();
      await expect(run(base(main, id))).rejects.toMatchObject({
        ...REFUSED,
        message: 'probe_main: потрібен переклад основною мовою (name)',
      });
      expect(await count(main, id)).toBe(0);
    });

    it('база + рядок основної мови — коміт', async () => {
      const id = randomUUID();
      await run(base(main, id), tr(main, id, 'uk', 'Назва'));
      expect(await count(main, id)).toBe(1);
    });

    it('рядок лише іншої мови — відмова', async () => {
      const id = randomUUID();
      await expect(
        run(base(main, id), tr(main, id, 'en', 'Name')),
      ).rejects.toMatchObject(REFUSED);
    });

    it('видалення рядка основної мови — відмова', async () => {
      const id = await seed();
      await expect(
        run(deleteTranslation(main, id, 'uk')),
      ).rejects.toMatchObject(REFUSED);
    });

    it("очищення обов'язкового поля — відмова", async () => {
      const id = await seed();
      await expect(
        run(upd(main, 'name = null', `probe_id = '${id}' and locale = 'uk'`)),
      ).rejects.toMatchObject(REFUSED);
    });

    it("прямий SQL: name = '' і name = '   ' у рядку основної мови — відмова", async () => {
      const id = await seed();
      for (const blank of ["''", "'   '"])
        await expect(
          run(
            upd(
              main,
              `name = ${blank}`,
              `probe_id = '${id}' and locale = 'uk'`,
            ),
          ),
        ).rejects.toMatchObject(REFUSED);
    });

    it('необовʼязкове поле очистити можна', async () => {
      const id = await seed();
      await run(upd(main, 'note = null', `probe_id = '${id}'`));
      expect(await count(main, id)).toBe(1);
    });

    it('кілька обовʼязкових колонок: кожна мусить бути непорожньою', async () => {
      const id = randomUUID();
      await expect(
        run(base(multi, id), tr(multi, id, 'uk', 'Назва', '   ')),
      ).rejects.toMatchObject({
        ...REFUSED,
        message: 'probe_multi: потрібен переклад основною мовою (name, note)',
      });
      await run(base(multi, id), tr(multi, id, 'uk', 'Назва', 'Нотатка'));
      expect(await count(multi, id)).toBe(1);
    });

    it('зміна locale рядка основної мови на en — відмова', async () => {
      const id = randomUUID();
      await run(base(main, id), tr(main, id, 'uk', 'Назва'));
      await expect(
        run(upd(main, "locale = 'en'", `probe_id = '${id}'`)),
      ).rejects.toMatchObject(REFUSED);
    });

    it('перенесення рядка основної мови на іншу сутність (зміна FK) — відмова для старої', async () => {
      const from = await seed();
      const to = randomUUID();
      await expect(
        run(
          base(main, to),
          tr(main, to, 'en', 'Name'),
          upd(
            main,
            `probe_id = '${to}'`,
            `probe_id = '${from}' and locale = 'uk'`,
          ),
        ),
      ).rejects.toMatchObject({
        ...REFUSED,
        detail: expect.stringContaining(from),
      });
    });

    it('видалення бази каскадом — коміт', async () => {
      const id = await seed();
      await run(deleteBase(main, id));
      expect(await count(main, id)).toBe(0);
    });

    it('видалити базу й вставити знову в тій самій транзакції без перекладу — відмова', async () => {
      const id = await seed();
      await expect(
        run(deleteBase(main, id), base(main, id)),
      ).rejects.toMatchObject(REFUSED);
      expect(await count(main, id)).toBe(1);
    });

    it('умова [5]: рядок з kind<>text не вимагає перекладу', async () => {
      const number = randomUUID();
      await run(base(cond, number, 'number'));
      expect(await count(cond, number)).toBe(1);
      // Позитивний контроль: той самий рядок із kind=text без перекладу — відмова.
      await expect(run(base(cond, randomUUID(), 'text'))).rejects.toMatchObject(
        REFUSED,
      );
    });

    it('умова [5]: UPDATE колонки умови на text вимагає перекладу', async () => {
      const id = randomUUID();
      await run(base(cond, id, 'number'));
      const toText = `update public.${cond.baseSql} set kind = 'text' where id = '${id}'`;
      await expect(run(toText)).rejects.toMatchObject(REFUSED);
      // Позитивний контроль: той самий UPDATE разом із перекладом комітиться.
      await run(toText, tr(cond, id, 'uk', 'Назва'));
      const rows = await queryRows(
        dbUrl,
        `select kind from public.${cond.baseSql} where id = $1`,
        [id],
      );
      expect(rows).toEqual([{ kind: 'text' }]);
    });

    it('права актора: без SELECT на переклади commit дає 42501', async () => {
      const id = randomUUID();
      const table = `public.${main.translationsSql}`;
      await queryRows(dbUrl, `revoke select on ${table} from ${actor.role}`);
      try {
        await expect(
          run(base(main, id), tr(main, id, 'uk', 'Назва')),
        ).rejects.toMatchObject({ code: '42501' });
      } finally {
        await queryRows(dbUrl, `grant select on ${table} to ${actor.role}`);
      }
      // Грант повернуто — той самий набір стейтментів знову комітиться.
      await run(base(main, id), tr(main, id, 'uk', 'Назва'));
    });

    it('ідентифікатор із лапкою в TG_ARGV не ламає SQL', async () => {
      const id = randomUUID();
      await run(base(quoted, id), tr(quoted, id, 'uk', 'Назва'));
      expect(await count(quoted, id)).toBe(1);
      await expect(run(base(quoted, randomUUID()))).rejects.toMatchObject({
        ...REFUSED,
        message: 'probe_q"x: потрібен переклад основною мовою (name)',
      });
    });
  },
);
