// Поведінкова матриця RLS: «актор × таблиця × операція» (Task 5, план В2-К1а).
//
// 🔴 Навіщо він, якщо є парність тексту. Старий `rls-parity` звіряв ЛИШЕ текст
// політик із дампом живої БД: він ловив дрейф, але жоден із режимів відмови
// нижче не червонив би — політика могла бути на місці слово в слово й при
// цьому пускати не тих. Тут міряється результат: хто які рядки бачить і які
// записи проходять.
//
// Актори: анонім (роль `app_user` без GUC), користувачі A і B, адмін
// (`app_admin`), гість із `app.order_token`. Усі — через `withActor`
// (`../actors.mjs`), тобто через ту саму транзакційну форму, яку зобовʼязаний
// ставити рантайм: BEGIN → set_config(local) → SET LOCAL ROLE → … → COMMIT.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveHarness } from '../up.mjs';
import {
  applySqlFiles,
  createTempDatabase,
  dropTempDatabase,
  queryRows,
  randomDbName,
  withDbName,
  withUser,
} from '../apply.mjs';
import { withActor, withActorSession } from '../actors.mjs';
import {
  countSql,
  GUEST_TOKEN,
  MEDIA_INSERT,
  MEDIA_OWNERSHIP_COLUMNS,
  mediaRebindSql,
  ORDER_A,
  ORDER_GUEST,
  recipientInsert,
  SEED_STATEMENTS,
  USER_A,
  USER_ADMIN,
  USER_B,
} from './fixtures/rls-actors';

const CANON_DIR = join(import.meta.dirname, '../../../migrations');

interface Actor {
  userId?: string;
  role?: string;
  orderToken?: string;
  localClaims?: boolean;
}

const AS_A: Actor = { userId: USER_A, role: 'app_user' };
const AS_B: Actor = { userId: USER_B, role: 'app_user' };
const AS_ADMIN: Actor = { userId: USER_ADMIN, role: 'app_admin' };
/** Анонім — та сама роль, просто без GUC: `app.current_user_id()` дає NULL. */
const AS_ANON: Actor = { role: 'app_user' };
const asGuest = (orderToken: string): Actor => ({
  role: 'app_user',
  orderToken,
});

describe('поведінка RLS: матриця акторів', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_rls_behaviour');
  // Імʼя ролі-порушника унікальне на прогін: ролі в PostgreSQL кластерні, і
  // залишок від упалого прогону інакше блокував би наступний.
  const bypassRole = `zz_bypass_${dbName.slice(-12)}`;
  let dbUrl: string;
  let runtimeUrl: string;

  /** Скільки рядків віддає запит цьому акторові. */
  const countAs = async (actor: Actor, sql: string): Promise<number> => {
    const rows = (await withActor(runtimeUrl, actor, [sql])) as { n: number }[];
    return rows[0].n;
  };

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(
      dbUrl,
      readdirSync(CANON_DIR)
        .filter((name) => name.endsWith('.sql'))
        .sort()
        .map((name) => join(CANON_DIR, name)),
    );
    for (const statement of SEED_STATEMENTS) await queryRows(dbUrl, statement);
    // Застосунок ЛОГІНИТЬСЯ саме як `app_runtime` — інакше негативні контролі
    // міряли б `SET ROLE` з-під власника, який обходить і гранти, і RLS.
    runtimeUrl = withUser(dbUrl, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  it('свої рядки видно, чужі — ні, аноніму — жодного', async () => {
    const wishlists = countSql('wishlists');
    expect(await countAs(AS_A, wishlists)).toBe(1);
    expect(await countAs(AS_B, wishlists)).toBe(1);
    expect(await countAs(AS_ANON, wishlists)).toBe(0);

    // Лічильника мало: рівно один рядок в обох — це ще й стан «кожен бачить
    // ЧУЖИЙ рядок». Тож звіряємо власника того, що видно.
    const rows = (await withActor(runtimeUrl, AS_A, [
      'select user_id from public.wishlists',
    ])) as { user_id: string }[];
    expect(rows.map((row) => row.user_id)).toEqual([USER_A]);
  });

  it('профіль, адреси й замовлення звужені до власника', async () => {
    expect(await countAs(AS_A, countSql('profiles'))).toBe(1);
    expect(await countAs(AS_ANON, countSql('profiles'))).toBe(0);
    expect(await countAs(AS_B, countSql('user_addresses'))).toBe(1);

    const own = countSql('orders', `id = '${ORDER_A}'`);
    expect(await countAs(AS_A, own)).toBe(1);
    expect(await countAs(AS_B, own)).toBe(0);
  });

  it('відгуки: схвалені видно всім, чернетка — лише автору', async () => {
    const reviews = countSql('product_reviews');
    expect(await countAs(AS_ANON, reviews)).toBe(1);
    expect(await countAs(AS_A, reviews)).toBe(2);
    expect(await countAs(AS_B, reviews)).toBe(1);
  });

  it('адмін бачить усе — і замовлення, і профілі', async () => {
    expect(await countAs(AS_ADMIN, countSql('orders'))).toBe(2);
    expect(await countAs(AS_ADMIN, countSql('profiles'))).toBe(2);
  });

  // 🔴 Блок додано 2026-08-23 (борг К1а-9). Рев'ю довело мутацією, що ці
  // чотири таблиці мали політики, ACL і текстову парність — але жодного
  // запиту двома акторами. Підміна `user_roles_select_own` на `using: true`
  // лишала весь гейт зеленим (42/42). Тепер кожна з них екзаменується
  // так само, як решта: свій рядок видно, чужий — ні, адмін — усе.
  it('порівняння і заявки на послуги звужені до власника', async () => {
    const comparisons = countSql('comparisons');
    expect(await countAs(AS_A, comparisons)).toBe(1);
    expect(await countAs(AS_B, comparisons)).toBe(1);
    expect(await countAs(AS_ANON, comparisons)).toBe(0);
    // 🔴 Адмін тут дістає НЕ «0 рядків», а відмову: `comparisons` не має
    // адмінської політики, тож і гранта `app_admin` на неї немає (правило
    // Task 4: набір команд гранта = обʼєднанню команд політик тієї ж ролі).
    // Асертимо саме відмову — «0 рядків» приховало б появу зайвого гранта.
    await expect(
      withActor(runtimeUrl, { userId: USER_ADMIN, role: 'app_admin' }, [
        comparisons,
      ]),
    ).rejects.toThrow(/permission denied/i);

    const requests = countSql('service_requests');
    expect(await countAs(AS_A, requests)).toBe(1);
    expect(await countAs(AS_ANON, requests)).toBe(0);
    // Адмінська політика `service_requests_admin_all` — на відміну від
    // `comparisons`, де адмінської політики свідомо немає.
    expect(await countAs(AS_ADMIN, requests)).toBe(2);
  });

  it('історія категорій і ролі: чужий рядок невидимий', async () => {
    const history = countSql('user_category_history');
    expect(await countAs(AS_A, history)).toBe(1);
    expect(await countAs(AS_B, history)).toBe(1);
    expect(await countAs(AS_ANON, history)).toBe(0);
    expect(await countAs(AS_ADMIN, history)).toBe(2);

    // 🔴 Саме на цій таблиці мутація рев'ю лишалась непоміченою. Побачити
    // чужий рядок `user_roles` = дізнатись, хто в магазині адмін.
    const roles = countSql('user_roles');
    expect(await countAs(AS_A, roles)).toBe(1);
    expect(await countAs(AS_ANON, roles)).toBe(0);
    expect(await countAs(AS_ADMIN, roles)).toBe(3);

    // Лічильника мало — звіряємо, що видно САМЕ свій рядок.
    const rows = (await withActor(runtimeUrl, AS_A, [
      'select user_id from public.user_roles',
    ])) as { user_id: string }[];
    expect(rows.map((row) => row.user_id)).toEqual([USER_A]);
  });

  it('WITH CHECK: INSERT на чужий user_id відбито, на свій — проходить', async () => {
    // Без WITH CHECK власник рядка підмінявся б на етапі запису: USING ховає
    // чуже лише від ЧИТАННЯ, писати чуже він не заважає.
    await expect(
      withActor(runtimeUrl, AS_A, [recipientInsert(USER_B)]),
    ).rejects.toThrow(/row-level security/i);
    await expect(
      withActor(runtimeUrl, AS_A, [recipientInsert(USER_A)]),
    ).resolves.toEqual([]);
    expect(await countAs(AS_A, countSql('user_recipients'))).toBe(1);
    expect(await countAs(AS_B, countSql('user_recipients'))).toBe(0);
  });

  it('гостьове замовлення: за токеном видно, з чужим і без — ні', async () => {
    const guest = countSql('orders', `id = '${ORDER_GUEST}'`);
    expect(await countAs(asGuest(GUEST_TOKEN), guest)).toBe(1);
    expect(await countAs(asGuest('not-a-token'), guest)).toBe(0);
    // Порожній токен окремо: `nullif(…, '')` мусить дати NULL, інакше рядок із
    // порожнім `access_token` збігався б із кожним «безтокенним» запитом.
    expect(await countAs(asGuest(''), guest)).toBe(0);
    expect(await countAs(AS_ANON, guest)).toBe(0);

    const items = countSql('order_items', `order_id = '${ORDER_GUEST}'`);
    expect(await countAs(asGuest(GUEST_TOKEN), items)).toBe(1);
    expect(await countAs(AS_ANON, items)).toBe(0);
  });

  it('media: перепривʼязка відбита, читання й завантаження — ні', async () => {
    // 🔴 Незмінність колонок власності тримається ВІДСУТНІСТЮ права UPDATE, а
    // не тригером — тому й відмова тут `permission denied`, а не порушення RLS.
    for (const column of MEDIA_OWNERSHIP_COLUMNS)
      await expect(
        withActor(runtimeUrl, AS_A, [mediaRebindSql(column)]),
      ).rejects.toThrow(/permission denied/i);

    expect(await countAs(AS_A, countSql('media'))).toBe(1);
    await expect(withActor(runtimeUrl, AS_A, [MEDIA_INSERT])).resolves.toEqual(
      [],
    );
  });

  describe('негативні контролі', () => {
    it('без SET LOCAL ROLE усе падає з permission denied', async () => {
      // Клас дефекту: забутий `SET LOCAL ROLE`. Історично зʼєднання йшло
      // ВЛАСНИКОМ таблиць — а власник поза RLS за побудовою, тож той самий
      // пропуск мовчки віддавав ЧУЖІ рядки. Тут він мусить дати відмову; без
      // цього кейса вся матриця вище нічого не доводила б про рантайм.
      await expect(
        withActor(runtimeUrl, { userId: USER_A }, [countSql('wishlists')]),
      ).rejects.toThrow(/permission denied/i);
      // Позитивний контроль: та сама транзакція з перемиканням ролі працює,
      // тобто відмова вище — саме про роль, а не про конект чи схему.
      expect(await countAs(AS_A, countSql('wishlists'))).toBe(1);

      // Структурна причина відмови — щоб діагноз був миттєвим, а не через
      // біновий пошук по матриці. З PostgreSQL 16 успадкування живе в САМОМУ
      // членстві, і членство з `inherit_option = true` віддає права `app_user`
      // ще ДО `SET LOCAL ROLE` (спіймано на харнесі 2026-08-23 — звідси
      // `WITH INHERIT FALSE` у `0000_prelude.sql`).
      const memberships = (await queryRows(
        dbUrl,
        `select roleid::regrole::text as role, inherit_option, set_option
           from pg_auth_members where member::regrole::text = 'app_runtime'
          order by 1`,
      )) as { role: string; inherit_option: boolean; set_option: boolean }[];
      expect(memberships).toEqual([
        { role: 'app_admin', inherit_option: false, set_option: true },
        { role: 'app_user', inherit_option: false, set_option: true },
      ]);
    });

    it('роль із BYPASSRLS бачить чуже — матриця міряє саме RLS', async () => {
      // Клас дефекту: «зелено, бо даних немає». Якби фікстури не заводили
      // чужих рядків, нулі вище були б правдою й без жодної політики. Тут та
      // сама таблиця під тим самим грантом віддає 2 рядки, щойно RLS обійдено.
      await queryRows(dbUrl, `create role "${bypassRole}" login`);
      await queryRows(dbUrl, `grant usage on schema public to "${bypassRole}"`);
      await queryRows(
        dbUrl,
        `grant select on table public.wishlists to "${bypassRole}"`,
      );
      const bypassUrl = withUser(dbUrl, bypassRole);
      const total = countSql('wishlists');
      const seen = async () =>
        (
          (await withActor(bypassUrl, { userId: USER_A }, [total])) as {
            n: number;
          }[]
        )[0].n;
      try {
        // Без BYPASSRLS: грант є, політик `to <ця роль>` немає — нуль рядків.
        expect(await seen()).toBe(0);
        await queryRows(dbUrl, `alter role "${bypassRole}" bypassrls`);
        expect(await seen()).toBe(2);
      } finally {
        // Роль кластерна — прибираємо за собою, інакше вона переживе БД.
        await queryRows(dbUrl, `drop owned by "${bypassRole}"`);
        await queryRows(dbUrl, `drop role if exists "${bypassRole}"`);
      }
    });

    it('set_config(…, false) — claims переживають COMMIT і течуть далі', async () => {
      // Клас дефекту: сесійні claims у пулі. З `local=false` значення живе до
      // кінця ЗʼЄДНАННЯ, а не транзакції, — у пулі наступний запит дістав би
      // чужу ідентичність. Саме тому `withActor` (Task 6) зобовʼязаний ставити
      // `local=true`, і саме це тут виміряно, а не задекларовано.
      type Run = (actor: Actor, sql: string[]) => Promise<{ n: number }[]>;
      await withActorSession(runtimeUrl, async (run: Run) => {
        const total = countSql('wishlists');
        expect((await run({ ...AS_A, localClaims: false }, [total]))[0].n).toBe(
          1,
        );
        // Наступна транзакція БЕЗ claims на тому ж зʼєднанні — і бачить A.
        expect((await run(AS_ANON, [total]))[0].n).toBe(1);

        // Контраст: після скидання GUC той самий анонім бачить нуль — тобто
        // одиниця вище була саме витоком, а не «політика пускає всіх».
        await run({ userId: '', localClaims: false }, ['select 1']);
        expect((await run(AS_ANON, [total]))[0].n).toBe(0);
      });
    });
  });
});
