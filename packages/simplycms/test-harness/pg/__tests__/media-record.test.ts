// Шапка — той самий патерн, що в admin-order-statuses.test.ts: resolveHarness
// → createTempDatabase → канон → app_runtime у DATABASE_URL; afterAll із
// closeDbPool() ПЕРШИМ.
import { readdirSync } from 'node:fs';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDbPool, withActor } from 'simplycms/db';
import { replaceAvatar } from 'simplycms/storefront/loaders';
import { eraseMedia, localFsDriver, writeMedia } from 'simplycms/storage';
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

const MIGRATIONS = join(import.meta.dirname, '../../../migrations');
const canonFiles = (): string[] =>
  readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => join(MIGRATIONS, name));

const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4,
]);

describe('writeMedia / eraseMedia проти живої БД (Е2, Task 3)', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_media_record');
  let dbUrl = '';
  let root = '';
  const driver = () => localFsDriver(root);

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(dbUrl, canonFiles());
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
    root = await mkdtemp(join(tmpdir(), 'simplycms-media-rec-'));
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    delete process.env.DATABASE_URL;
    if (root) await rm(root, { recursive: true, force: true });
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  /** Користувач + порожній профіль: заміні аватара потрібен рядок `profiles`. */
  const seedUser = async (url: string): Promise<string> => {
    const id = randomUUID();
    const email = `media-${id.slice(0, 8)}@example.test`;
    await queryRows(
      url,
      `insert into public.users (id, email, name, email_verified, created_at, updated_at)
       values ($1, $2, 'Живий Тест', false, now(), now())`,
      [id, email],
    );
    await queryRows(
      url,
      'insert into public.profiles (id, user_id, email) values ($1, $2, $3)',
      [randomUUID(), id, email],
    );
    return id;
  };

  /** Покупець із УЖЕ наявним аватаром: рядок `media` + `profiles.avatar_url`. */
  const seedUserWithAvatar = async (
    real: ReturnType<typeof driver>,
  ): Promise<{ userId: string; ref: string }> => {
    const userId = await seedUser(dbUrl);
    const record = await withActor({ role: 'app_admin' }, (db) =>
      writeMedia(
        db,
        {
          bytes: PNG,
          mime: 'image/png',
          entityType: 'avatar',
          entityId: userId,
          uploadedBy: userId,
        },
        real,
      ),
    );
    await queryRows(
      dbUrl,
      'update public.profiles set avatar_url = $1 where user_id = $2',
      [record.ref, userId],
    );
    return { userId, ref: record.ref };
  };

  /** Референс аватара в профілі — те, що бачить вітрина. */
  const avatarOf = async (userId: string): Promise<string | null> => {
    const [row] = (await queryRows(
      dbUrl,
      'select avatar_url from public.profiles where user_id = $1',
      [userId],
    )) as { avatar_url: string | null }[];
    return row?.avatar_url ?? null;
  };

  /** Усі опубліковані обʼєкти сховища — знімок для порівняння «до/після». */
  const diskKeys = async (): Promise<string[]> => {
    const keys: string[] = [];
    for (const shard of await readdir(root))
      for (const name of await readdir(join(root, shard)))
        keys.push(`${shard}/${name}`);
    return keys.sort();
  };

  const countMedia = async (): Promise<number> => {
    const [row] = (await queryRows(
      dbUrl,
      'select count(*)::int as n from public.media',
    )) as { n: number }[];
    return row.n;
  };

  it('пише файл і рядок з правильним size_bytes та mime_type', async () => {
    const record = await withActor({ role: 'app_admin' }, (db) =>
      writeMedia(
        db,
        {
          bytes: PNG,
          mime: 'image/png',
          entityType: 'product',
          entityId: null,
          uploadedBy: null,
        },
        driver(),
      ),
    );

    expect(record.ref).toMatch(/^[0-9a-f]{2}\//);
    expect(record.sizeBytes).toBe(PNG.length);

    const rows = await queryRows(
      dbUrl,
      `select storage_key, size_bytes, mime_type, entity_type
         from public.media where id = $1`,
      [record.id],
    );
    expect(rows).toEqual([
      {
        storage_key: record.ref,
        size_bytes: PNG.length,
        mime_type: 'image/png',
        entity_type: 'product',
      },
    ]);
    expect(await driver().open(record.ref)).not.toBeNull();
  });

  // 🔴 Ядро інваріанта §4-К4: облік і файл живуть або разом, або ніяк.
  it('падіння запису файлу відкочує рядок — ні файла, ні обліку', async () => {
    const before = await countMedia();
    const broken = {
      ...driver(),
      put: async () => {
        throw new Error('диск переповнено');
      },
    };

    await expect(
      withActor({ role: 'app_admin' }, (db) =>
        writeMedia(
          db,
          {
            bytes: PNG,
            mime: 'image/png',
            entityType: 'product',
            entityId: null,
            uploadedBy: null,
          },
          broken,
        ),
      ),
    ).rejects.toThrow('диск переповнено');

    expect(await countMedia()).toBe(before);
  });

  // 🔴 Порядок — інваріант, а не деталь: DELETE рядка мусить статись ДО
  // дотику до диска, інакше повертається клас «відмова БД знищила файл».
  it('eraseMedia видаляє рядок ДО обʼєкта, і обидва зникають', async () => {
    const real = driver();
    // 🔴 Борг Task 3 (розходження з планом, ОРІЄНТИР-рівень — формулювання
    // асерту): попередній тест ("пише файл...") навмисно не чистить свій
    // рядок — заміри лічильника мусять бути ВІДНОСНИМИ до `before`, а не
    // абсолютним `0`, інакше спільна БД файлу дає хибний RED.
    const before = await countMedia();
    const record = await withActor({ role: 'app_admin' }, (db) =>
      writeMedia(
        db,
        {
          bytes: PNG,
          mime: 'image/png',
          entityType: 'banner',
          entityId: null,
          uploadedBy: null,
        },
        real,
      ),
    );

    let rowsAtDeleteTime = -1;
    const removed = await withActor({ role: 'app_admin' }, async (db) => {
      const spy = {
        ...real,
        // 🔴 Читаємо ТИМ САМИМ `db` із колбека — тобто ВСЕРЕДИНІ транзакції,
        // де DELETE уже видно. Попередня редакція ходила ОКРЕМИМ зʼєднанням
        // (`countMedia`), якому незакомічений DELETE не видно в принципі:
        // лічильник лишався > 0 за БУДЬ-ЯКОГО порядку, тож перенесення
        // `driver.delete` перед `db.delete` гейт не червонило (рев'ю Е2).
        // Зсередини транзакції правильний порядок дає 0 рядків, інвертований — 1.
        delete: async (key: string) => {
          const found = await db.execute(
            sql`select id from public.media where storage_key = ${key}`,
          );
          rowsAtDeleteTime = found.rows.length;
          await real.delete(key);
        },
      };
      return eraseMedia(db, record.ref, spy);
    });

    expect(removed).toBe(true);
    expect(
      rowsAtDeleteTime,
      'DELETE рядка мусив статись ДО дотику до диска',
    ).toBe(0);
    expect(await real.open(record.ref)).toBeNull();
    expect(await countMedia()).toBe(before);
  });

  // 🔴 Доказ переваги порядку: помилка сховища відкочує рядок, і не
  // лишається ні орфана, ні напівстану.
  it('падіння driver.delete відкочує рядок — обидва на місці', async () => {
    const real = driver();
    const record = await withActor({ role: 'app_admin' }, (db) =>
      writeMedia(
        db,
        {
          bytes: PNG,
          mime: 'image/png',
          entityType: 'banner',
          entityId: null,
          uploadedBy: null,
        },
        real,
      ),
    );
    const broken = {
      ...real,
      delete: async () => {
        throw new Error('сховище недоступне');
      },
    };

    await expect(
      withActor({ role: 'app_admin' }, (db) =>
        eraseMedia(db, record.ref, broken),
      ),
    ).rejects.toThrow('сховище недоступне');

    const [row] = (await queryRows(
      dbUrl,
      'select storage_key from public.media where storage_key = $1',
      [record.ref],
    )) as { storage_key: string }[];
    expect(row?.storage_key).toBe(record.ref);
    expect(await real.open(record.ref)).not.toBeNull();

    await withActor({ role: 'app_admin' }, (db) =>
      eraseMedia(db, record.ref, real),
    );
  });

  it('eraseMedia неіснуючого референсу — false, без винятку', async () => {
    const removed = await withActor({ role: 'app_admin' }, (db) =>
      eraseMedia(db, `ff/${randomUUID()}.png`, driver()),
    );
    expect(removed).toBe(false);
  });

  // Залишковий стан «рядок без обʼєкта» (падіння COMMIT після unlink):
  // повтор його лікує, бо `ENOENT` — успіх.
  it('повтор eraseMedia після dangling-рядка проходить', async () => {
    const real = driver();
    const record = await withActor({ role: 'app_admin' }, (db) =>
      writeMedia(
        db,
        {
          bytes: PNG,
          mime: 'image/png',
          entityType: 'banner',
          entityId: null,
          uploadedBy: null,
        },
        real,
      ),
    );
    await real.delete(record.ref); // імітуємо перерваний прохід
    const removed = await withActor({ role: 'app_admin' }, (db) =>
      eraseMedia(db, record.ref, real),
    );
    expect(removed).toBe(true);
  });

  // 🔴 Другий рубіж у дії: `app_user` не має на `media` ні UPDATE, ні DELETE,
  // тож видалення падає ще на `select … for update` (Postgres вимагає для
  // нього UPDATE) — ДО дотику до диска. Файл лишається цілим.
  //
  // 🔴 Чим цей кейс НЕ є: доказом ПОРЯДКУ всередині `eraseMedia`. Відмова
  // стається на ПЕРШОМУ операторі, тобто до розгалуження «рядок чи обʼєкт
  // першим», і інвертований порядок лишав би його зеленим (рев'ю Е2). Доказ
  // порядку — наступний кейс, де відмова падає саме на `DELETE`.
  it('app_user: відмова на рядку, ФАЙЛ і рядок лишаються цілі', async () => {
    const real = driver();
    const record = await withActor({ role: 'app_admin' }, (db) =>
      writeMedia(
        db,
        {
          bytes: PNG,
          mime: 'image/png',
          entityType: 'avatar',
          entityId: null,
          uploadedBy: null,
        },
        real,
      ),
    );

    // 🔴 Борг Task 3 (розходження з планом, ОРІЄНТИР-рівень — формулювання
    // асерту): Drizzle перезагортає помилку драйвера — назовні летить
    // `Failed query: …`, а текст Postgres лишається в `cause` (той самий
    // висновок задокументований у `with-actor.test.ts`). Матчити відмову по
    // повідомленню верхнього рівня не вийде.
    const error = await withActor({ role: 'app_user' }, (db) =>
      eraseMedia(db, record.ref, real),
    ).then(
      () => null,
      (err: unknown) => err,
    );
    expect(error).toBeInstanceOf(Error);
    expect((error as { cause?: Error }).cause?.message).toMatch(
      /permission denied/i,
    );

    expect(await real.open(record.ref), 'файл мав лишитись').not.toBeNull();
    const [row] = (await queryRows(
      dbUrl,
      'select storage_key from public.media where storage_key = $1',
      [record.ref],
    )) as { storage_key: string }[];
    expect(row?.storage_key).toBe(record.ref);

    await withActor({ role: 'app_admin' }, (db) =>
      eraseMedia(db, record.ref, real),
    );
  });

  // 🔴 ГОЛОВНИЙ доказ порядку: відмова БД падає саме на `DELETE` рядка —
  // тобто ПІСЛЯ `select … for update` і рівно там, де порядок і вирішує.
  // За чинним порядком до диска не доходить, файл цілий; за інвертованим
  // («спершу обʼєкт») файл був би вже знищений, а рядок лишився б — стан,
  // якого повтор не лікує, бо права не зʼявляться.
  //
  // 🔴 Право знімається тимчасово й повертається у `finally`: актора з
  // `UPDATE`, але без `DELETE` на `media`, у схемі немає за побудовою —
  // `app_user` не має жодного з двох (`0002_grants.sql`), а третьої ролі
  // канон не заводить. Створювати роль повз канон означало б перевіряти
  // вигадану конфігурацію замість чинної.
  it('відмова саме на DELETE рядка: ФАЙЛ і рядок лишаються цілі', async () => {
    const real = driver();
    const record = await withActor({ role: 'app_admin' }, (db) =>
      writeMedia(
        db,
        {
          bytes: PNG,
          mime: 'image/png',
          entityType: 'banner',
          entityId: null,
          uploadedBy: null,
        },
        real,
      ),
    );

    await queryRows(
      dbUrl,
      'revoke delete on table public.media from app_admin',
    );
    let error: unknown;
    try {
      error = await withActor({ role: 'app_admin' }, (db) =>
        eraseMedia(db, record.ref, real),
      ).then(
        () => null,
        (err: unknown) => err,
      );
    } finally {
      await queryRows(dbUrl, 'grant delete on table public.media to app_admin');
    }

    expect(error).toBeInstanceOf(Error);
    expect((error as { cause?: Error }).cause?.message).toMatch(
      /permission denied/i,
    );
    expect(await real.open(record.ref), 'файл мав лишитись').not.toBeNull();
    const [row] = (await queryRows(
      dbUrl,
      'select storage_key from public.media where storage_key = $1',
      [record.ref],
    )) as { storage_key: string }[];
    expect(row?.storage_key).toBe(record.ref);

    await withActor({ role: 'app_admin' }, (db) =>
      eraseMedia(db, record.ref, real),
    );
  });

  // 🔴 Девʼятий кейс ганяє СПРАВЖНІЙ `replaceAvatar`, а не послідовність,
  // зібрану в тесті: копія доводила б властивість копії (патерн P1 — гейт
  // обіцяє більше, ніж перевіряє). Функція бере `userId` і драйвери
  // параметрами саме для цього. Борг хвилі B, закритий у Task 5.
  //
  // 🔴 Прогін іде через `replaceAvatar` — той самий вхід, що й у
  // `uploadMyAvatar`: кроки заміни з лоадерів не виходять, тож зібрати тут
  // послідовність без прибирання орфана вже неможливо. Саме такий розрив і
  // був дефектом до 2026-09-13: rollback прибирає рядок, диск про транзакції
  // не знає, і ФАЙЛ нового аватара лишався б назавжди.
  it('відмова на видаленні СТАРОГО: старий цілий, нового ні в БД, ні на диску', async () => {
    const real = driver();
    const { userId, ref: oldRef } = await seedUserWithAvatar(real);

    const broken = {
      ...real,
      delete: async () => {
        throw new Error('сховище недоступне');
      },
    };

    const filesBefore = await diskKeys();

    await expect(
      replaceAvatar(
        userId,
        { bytes: PNG, mime: 'image/png' },
        // Публікує зламаний драйвер, прибирає справний — розбіжність тут
        // НАВМИСНА (у `broken` зламано саме `delete`), тому й названа полем.
        { driver: broken, discardWith: real },
      ),
    ).rejects.toThrow('сховище недоступне');

    // Старий цілий і в БД, і на диску.
    expect(await avatarOf(userId)).toBe(oldRef);
    expect(await real.open(oldRef)).not.toBeNull();

    // Нового рядка немає — його прибрав rollback. Лічильник звужено до
    // ЦЬОГО покупця: інші кейси файлу теж пишуть аватари, і глобальний
    // `count` звʼязував би тести порядком виконання.
    const [{ n }] = (await queryRows(
      dbUrl,
      "select count(*)::int as n from public.media where entity_type = 'avatar' and entity_id = $1",
      [userId],
    )) as { n: number }[];
    expect(n).toBe(1);

    // 🔴 І нового ФАЙЛУ немає: rollback диска не чіпає, тож єдиний, хто
    // прибирає опублікований обʼєкт, — прибирання орфана. Знімок «до/після»,
    // а не пошук конкретного ключа: ref нового аватара назовні не виходить.
    expect(await diskKeys(), 'опублікований файл лишився орфаном').toEqual(
      filesBefore,
    );
  });

  // 🔴 Happy-path заміни. До рев'ю Е2 його не було НІДЕ: єдиний кейс
  // `replaceAvatar` ганяв лише гілку відкоту, тож видалення цілого блоку
  // `db.update(profiles)` лишало сюїту зеленою — заміна аватара могла б
  // перестати писати колонку непоміченою. `live:smoke` цього не ловить теж:
  // там аватар вантажиться один раз, тобто завжди з `previous === null`.
  it('успішна заміна: профіль на новому, старий обʼєкт прибрано', async () => {
    const real = driver();
    const { userId, ref: oldRef } = await seedUserWithAvatar(real);

    const { ref } = await replaceAvatar(
      userId,
      { bytes: PNG, mime: 'image/png' },
      { driver: real },
    );

    expect(ref).not.toBe(oldRef);
    expect(await avatarOf(userId), 'профіль мусить вести на НОВИЙ файл').toBe(
      ref,
    );
    expect(
      await real.open(ref),
      'новий обʼєкт мусить бути на диску',
    ).not.toBeNull();
    expect(await real.open(oldRef), 'старий обʼєкт мусить зникнути').toBeNull();

    // Рядок старого прибрано разом із файлом — у покупця рівно один аватар.
    const rows = (await queryRows(
      dbUrl,
      'select storage_key from public.media where entity_id = $1',
      [userId],
    )) as { storage_key: string }[];
    expect(rows).toEqual([{ storage_key: ref }]);
  });

  // 🔴 Доказ ПОРЯДКУ заміни (старий прибирається ОСТАННІМ): драйвер, у якого
  // `delete` СПРАВНИЙ, а `put` кидає. За чинним порядком до прибирання
  // старого не доходить — його файл цілий; за інвертованим («спершу прибрати
  // старий») він зник би безповоротно: rollback повертає РЯДОК, а не файл, і
  // покупець лишився б із профілем, що показує в нікуди. Кейс із поламаним
  // `delete` цієї різниці не бачить — там обидва порядки дають одне й те саме.
  it('падіння запису НОВОГО не чіпає ФАЙЛ старого', async () => {
    const real = driver();
    const { userId, ref: oldRef } = await seedUserWithAvatar(real);
    const broken = {
      ...real,
      put: async () => {
        throw new Error('диск переповнено');
      },
    };

    await expect(
      replaceAvatar(
        userId,
        { bytes: PNG, mime: 'image/png' },
        { driver: broken },
      ),
    ).rejects.toThrow('диск переповнено');

    expect(await real.open(oldRef), 'старий файл мав лишитись').not.toBeNull();
    expect(await avatarOf(userId)).toBe(oldRef);
  });

  it('тимчасові файли після всіх прогонів не лишились', async () => {
    for (const shard of await readdir(root)) {
      const files = await readdir(join(root, shard));
      expect(files.filter((n) => n.startsWith('.tmp-'))).toEqual([]);
    }
  });
});
