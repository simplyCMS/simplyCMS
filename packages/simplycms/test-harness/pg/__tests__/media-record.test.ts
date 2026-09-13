// Шапка — той самий патерн, що в admin-order-statuses.test.ts: resolveHarness
// → createTempDatabase → канон → app_runtime у DATABASE_URL; afterAll із
// closeDbPool() ПЕРШИМ.
//
// 🔴 Борг Task 3 (розходження з планом, ОРІЄНТИР-рівень — лічильник кейсів):
// у ПЛАНІ цей файл мав восьмий кейс "відмова на видаленні СТАРОГО" через
// СПРАВЖНЮ `replaceAvatarFor`/`withCustomerDb` з `simplycms/storefront/
// loaders` — але обидва зʼявляться лише в Task 5 (ще не приземлений на цій
// хвилі). Імпорт неіснуючого експорту звалив би `typecheck` і завадив би
// прогону решти кейсів, тож той кейс сюди НЕ додано — Task 5 додає його
// сюди сам, коли `replaceAvatarFor` існуватиме.
import { readdirSync } from 'node:fs';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDbPool, withActor } from 'simplycms/db';
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
    const spy = {
      ...real,
      delete: async (key: string) => {
        // Читаємо ОКРЕМИМ зʼєднанням: незакомічений DELETE звідси не
        // видно, тож рядок ще рахується — саме це й доводить, що ми
        // всередині транзакції, а не після коміту.
        rowsAtDeleteTime = await countMedia();
        await real.delete(key);
      },
    };
    const removed = await withActor({ role: 'app_admin' }, (db) =>
      eraseMedia(db, record.ref, spy),
    );

    expect(removed).toBe(true);
    expect(rowsAtDeleteTime).toBeGreaterThan(0); // DELETE ще не закомічено
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

  // 🔴 Другий рубіж у дії — і водночас ГОЛОВНИЙ доказ нового порядку:
  // `app_user` не має гранта DELETE, тож падіння стається на рядку, ДО
  // дотику до диска. Файл лишається цілим. За старим порядком («спершу
  // обʼєкт») цей самий сценарій знищив би файл безповоротно й лишив рядок,
  // якого повтор не лікує, бо права не зʼявляться.
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

  it('тимчасові файли після всіх прогонів не лишились', async () => {
    for (const shard of await readdir(root)) {
      const files = await readdir(join(root, shard));
      expect(files.filter((n) => n.startsWith('.tmp-'))).toEqual([]);
    }
  });
});
