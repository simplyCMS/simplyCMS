// Синк пароля app_runtime (К3-Е8, Е8-О2). Харнес і CI Schema автентифікують
// `trust`, тож логін із паролем пройшов би з БУДЬ-ЯКИМ паролем — це не
// доказ. Доказ — верифікатор SCRAM у `pg_authid.rolpassword`: StoredKey,
// обчислений із очікуваного пароля, мусить збігтися зі збереженим.
//
// 🔴 `ALTER ROLE` кластерний, а харнес спільний: верифікатор до кейсу
// зберігається й відновлюється в `finally`, інакше паралельні прогони на
// не-trust кластері лишились би без робочого пароля.
import { createHash, createHmac, pbkdf2Sync } from 'node:crypto';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { applyMigrations } from 'simplycms/migrate';
import { resolveHarness } from '../up.mjs';
import { queryRows } from '../apply.mjs';
import { CANON_DIR, freshDb } from './fixtures/migrate';

const PASSWORD = 'N3w-P@ss';

/** Рядок підключення з іншим користувачем і паролем (percent-encoding — URL). */
const withCredentials = (url: string, user: string, password: string) => {
  const next = new URL(url);
  next.username = user;
  next.password = encodeURIComponent(password);
  return next.toString();
};

const verifier = async (url: string): Promise<string | null> =>
  (
    (await queryRows(
      url,
      `select rolpassword from pg_authid where rolname = 'app_runtime'`,
    )) as { rolpassword: string | null }[]
  )[0]!.rolpassword;

/** Чи відповідає SCRAM-верифікатор паролю (RFC 5802/7677: StoredKey). */
const scramMatches = (stored: string | null, password: string): boolean => {
  const parts = /^SCRAM-SHA-256\$(\d+):([^$]+)\$([^:]+):(.+)$/.exec(
    stored ?? '',
  );
  if (!parts) throw new Error('rolpassword не є верифікатором SCRAM-SHA-256');
  const [, iterations, salt, storedKey] = parts;
  const salted = pbkdf2Sync(
    password,
    Buffer.from(salt!, 'base64'),
    Number(iterations),
    32,
    'sha256',
  );
  const clientKey = createHmac('sha256', salted).update('Client Key').digest();
  return createHash('sha256').update(clientKey).digest('base64') === storedKey;
};

describe('applyMigrations: пароль app_runtime', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  let db: Awaited<ReturnType<typeof freshDb>>;
  let saved: string | null;

  beforeAll(async () => {
    harness = await resolveHarness();
    db = await freshDb(harness.url);
    await applyMigrations({ connectionString: db.url, dir: CANON_DIR });
  }, 120_000);

  beforeEach(async () => {
    saved = await verifier(harness.url);
  });

  afterEach(async () => {
    // Той самий верифікатор, що був до кейсу (а не «якийсь пароль»).
    await queryRows(
      harness.url,
      saved === null
        ? 'alter role app_runtime password null'
        : `alter role app_runtime password '${saved.replace(/'/g, "''")}'`,
    );
  });

  afterAll(async () => {
    await db?.drop();
    await harness?.teardown();
  });

  it('runtimeUrl під app_runtime → StoredKey збігається з новим паролем; пароля в лозі немає', async () => {
    const lines: string[] = [];
    const report = await applyMigrations({
      connectionString: db.url,
      dir: CANON_DIR,
      runtimeUrl: withCredentials(db.url, 'app_runtime', PASSWORD),
      log: (line) => lines.push(line),
    });
    expect(report.runtimePasswordSynced).toBe(true);
    expect(scramMatches(await verifier(harness.url), PASSWORD)).toBe(true);
    // Негативний контроль самої перевірки: інший пароль не збігається.
    expect(scramMatches(await verifier(harness.url), `${PASSWORD}x`)).toBe(
      false,
    );
    const log = lines.join('\n');
    expect(log).toContain('синхронізовано');
    expect(log).not.toContain(PASSWORD);
    expect(log).not.toContain(encodeURIComponent(PASSWORD));
  }, 120_000);

  it('runtimeUrl з іншим користувачем → не синхронізовано, пароль не змінено', async () => {
    const lines: string[] = [];
    const report = await applyMigrations({
      connectionString: db.url,
      dir: CANON_DIR,
      runtimeUrl: withCredentials(db.url, 'someone_else', PASSWORD),
      log: (line) => lines.push(line),
    });
    expect(report.runtimePasswordSynced).toBe(false);
    expect(await verifier(harness.url)).toBe(saved);
    expect(lines.join('\n')).not.toContain(PASSWORD);
  }, 120_000);
});
