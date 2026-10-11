// Шапка — той самий патерн, що в admin-order-statuses.test.ts: resolveHarness
// → createTempDatabase → канон → app_runtime у DATABASE_URL; afterAll із
// closeDbPool() ПЕРШИМ.
import { readdirSync } from 'node:fs';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDbPool, withActor } from 'simplycms/db';
import { replaceAvatar } from 'simplycms/storefront/loaders';
import { eraseMediaRows, localFsDriver, writeMedia } from 'simplycms/storage';
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

describe('writeMedia / eraseMediaRows проти живої БД (Е2, Task 3)', () => {
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

  // 🔴 Другий рубіж: `app_user` не має на `media` ні UPDATE, ні DELETE, тож
  // перша фаза падає ще на `select … for update` — рядок і файл цілі.
  it('eraseMediaRows під app_user: відмова на рядку, рядок і файл цілі', async () => {
    const real = driver();
    const userId = randomUUID();
    const record = await withActor({ role: 'app_admin' }, (db) =>
      writeMedia(
        db,
        {
          bytes: PNG,
          mime: 'image/png',
          entityType: 'avatar',
          entityId: userId,
          uploadedBy: null,
        },
        real,
      ),
    );
    const error = await withActor({ role: 'app_user' }, (db) =>
      eraseMediaRows(db, [record.ref], {
        entityType: 'avatar',
        entityId: userId,
      }),
    ).then(
      () => null,
      (err: unknown) => err,
    );
    expect(error).toBeInstanceOf(Error);
    // Drizzle перезагортає помилку драйвера: текст Postgres у `cause`.
    expect((error as { cause?: Error }).cause?.message).toMatch(
      /permission denied/i,
    );
    expect(await real.open(record.ref), 'файл мав лишитись').not.toBeNull();
    expect(await countMedia()).toBeGreaterThan(0);
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
  // 🔴 Двофазність (Е6д-14): збій `driver.delete` старого файлу стається ПІСЛЯ
  // COMMIT і заміну не відкочує — профіль на новому, рядок старого стерто, а
  // файл старого тримає хвіст outbox (attempts = 1).
  it('збій стирання СТАРОГО файлу: заміна відбулась, хвіст в outbox', async () => {
    const real = driver();
    const { userId, ref: oldRef } = await seedUserWithAvatar(real);
    const broken = {
      ...real,
      delete: async () => {
        throw new Error('сховище недоступне');
      },
    };

    const { ref } = await replaceAvatar(
      userId,
      { bytes: PNG, mime: 'image/png' },
      { driver: broken },
    );

    expect(await avatarOf(userId)).toBe(ref);
    expect(await real.open(oldRef), 'файл лишається до повтору').not.toBeNull();
    const tail = (await queryRows(
      dbUrl,
      'select attempts from public.media_erasures where storage_key = $1',
      [oldRef],
    )) as { attempts: number }[];
    expect(tail).toEqual([{ attempts: 1 }]);
    const left = (await queryRows(
      dbUrl,
      'select storage_key from public.media where entity_id = $1',
      [userId],
    )) as { storage_key: string }[];
    expect(left).toEqual([{ storage_key: ref }]);
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

  // 🔴 Е6д-14/16: перша фаза двофазного стирання. Видаляє лише рядки `media`
  // власника, повертає ЛИШЕ видалені ключі й файлів не чіпає.
  it('eraseMediaRows: лише свої ключі власника, чужі й не-media ігноруються', async () => {
    const real = driver();
    const own = randomUUID();
    const put = (entityType: string, entityId: string) =>
      withActor({ role: 'app_admin' }, (db) =>
        writeMedia(
          db,
          {
            bytes: PNG,
            mime: 'image/png',
            entityType,
            entityId,
            uploadedBy: null,
          },
          real,
        ),
      );
    const mine = await put('banner', own);
    const foreign = await put('banner', randomUUID());
    const otherType = await put('product', own);
    const refs = [
      'data:image/png;base64,AAAA',
      'ab/00000000-0000-4000-8000-000000000000.png',
      foreign.ref,
      otherType.ref,
      mine.ref,
    ];

    const erased = await withActor({ role: 'app_admin' }, (db) =>
      eraseMediaRows(db, refs, { entityType: 'banner', entityId: own }),
    );

    expect(erased).toEqual([mine.ref]);
    const left = (await queryRows(
      dbUrl,
      'select storage_key from public.media where storage_key = any($1) order by storage_key',
      [[mine.ref, foreign.ref, otherType.ref]],
    )) as { storage_key: string }[];
    expect(left.map((r) => r.storage_key)).toEqual(
      [foreign.ref, otherType.ref].sort(),
    );
    // Файл стирає ВИКЛИКАЧ після COMMIT (`completeMediaErasures`), не ця функція.
    expect(await real.open(mine.ref)).not.toBeNull();
  });

  it('тимчасові файли після всіх прогонів не лишились', async () => {
    for (const shard of await readdir(root)) {
      const files = await readdir(join(root, shard));
      expect(files.filter((n) => n.startsWith('.tmp-'))).toEqual([]);
    }
  });
});
