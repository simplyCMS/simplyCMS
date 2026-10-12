// Синк пароля app_runtime (К3-Е8, Е8-О2, рішення Р15). Харнес і CI Schema
// автентифікують `trust`, тож логін із паролем пройшов би з БУДЬ-ЯКИМ
// паролем — це не доказ. Доказів три:
//   1. ОРАКУЛ — сам Postgres: він хешує відкритий пароль під
//      `password_encryption='scram-sha-256'`, а наша `scramSha256Verifier` із
//      його сіллю й ітераціями мусить дати той самий рядок байт у байт. Тест
//      не тримає власної копії математики SCRAM.
//   2. `rolpassword` після накату — рівно той верифікатор, що ми надіслали:
//      нерозпізнаний секрет Postgres мовчки хешує вдруге як відкритий пароль.
//   3. У жодному SQL, що пішов на сервер, немає відкритого пароля.
//
// 🔴 `ALTER ROLE` кластерний, а харнес спільний: верифікатор `app_runtime`
// зберігається до кейсу й відновлюється після, оракул ходить тимчасовою роллю.
import pg from 'pg';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { applyMigrations, scramSha256Verifier } from 'simplycms/migrate';
import { resolveHarness } from '../up.mjs';
import { queryRows, randomDbName } from '../apply.mjs';
import { CANON_DIR, freshDb } from './fixtures/migrate';

const PASSWORD = 'N3w-P@ss';
/** Пробіл і всі спецсимволи URL, включно з лапкою, — друкований ASCII. */
const ORACLE_PASSWORDS = [
  PASSWORD,
  'pass with spaces',
  'p%40ss:/?#[]@!$&\'()*+,;=~`"\\',
];

/** Рядок підключення з іншим користувачем і паролем (percent-encoding — URL). */
const withCredentials = (url: string, user: string, password: string) => {
  const next = new URL(url);
  next.username = user;
  next.password = encodeURIComponent(password);
  return next.toString();
};

const rolpassword = async (url: string, role: string): Promise<string | null> =>
  (
    (await queryRows(
      url,
      'select rolpassword from pg_authid where rolname = $1',
      [role],
    )) as { rolpassword: string | null }[]
  )[0]!.rolpassword;

/** Сіль та ітерації з верифікатора, який зробив сам Postgres. */
const saltAndIterations = (verifier: string | null) => {
  const parts = /^SCRAM-SHA-256\$(\d+):([^$]+)\$/.exec(verifier ?? '');
  if (!parts) throw new Error('rolpassword не є верифікатором SCRAM-SHA-256');
  return {
    iterations: Number(parts[1]),
    salt: Buffer.from(parts[2]!, 'base64'),
  };
};

describe('пароль app_runtime: верифікатор SCRAM', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  let db: Awaited<ReturnType<typeof freshDb>>;
  let saved: string | null;

  beforeAll(async () => {
    harness = await resolveHarness();
    db = await freshDb(harness.url);
    await applyMigrations({ connectionString: db.url, dir: CANON_DIR });
  }, 120_000);

  beforeEach(async () => {
    saved = await rolpassword(harness.url, 'app_runtime');
  });

  afterEach(async () => {
    vi.restoreAllMocks();
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

  it('оракул: Postgres і scramSha256Verifier дають той самий верифікатор', async () => {
    const role = randomDbName('scram_oracle');
    const client = new pg.Client({ connectionString: harness.url });
    await client.connect();
    try {
      await client.query(`create role ${role} nologin`);
      await client.query("set password_encryption = 'scram-sha-256'");
      for (const password of ORACLE_PASSWORDS) {
        await client.query(
          `alter role ${role} password ${client.escapeLiteral(password)}`,
        );
        const fromPostgres = await rolpassword(harness.url, role);
        const { salt, iterations } = saltAndIterations(fromPostgres);
        expect(scramSha256Verifier(password, salt, iterations)).toBe(
          fromPostgres,
        );
      }
    } finally {
      await client.query(`drop role if exists ${role}`);
      await client.end();
    }
  });

  it('runtimeUrl під app_runtime → rolpassword = надісланий верифікатор, пароля в SQL і лозі немає', async () => {
    const query = vi.spyOn(pg.Client.prototype, 'query');
    const lines: string[] = [];
    const report = await applyMigrations({
      connectionString: db.url,
      dir: CANON_DIR,
      runtimeUrl: withCredentials(db.url, 'app_runtime', PASSWORD),
      log: (line) => lines.push(line),
    });
    expect(report.runtimePasswordSynced).toBe(true);

    const sent = query.mock.calls.map(([arg]) =>
      typeof arg === 'string' ? arg : JSON.stringify(arg),
    );
    for (const sql of sent) expect(sql).not.toContain(PASSWORD);
    const alter = sent.filter((sql) => /^alter role app_runtime/.test(sql));
    expect(alter).toHaveLength(1);
    const literal = /password '([^']+)'$/.exec(alter[0]!)?.[1];
    expect(await rolpassword(harness.url, 'app_runtime')).toBe(literal);

    const log = lines.join('\n');
    expect(log).toContain('синхронізовано');
    expect(log).not.toContain(PASSWORD);
    expect(log).not.toContain(encodeURIComponent(PASSWORD));
  }, 120_000);

  it('runtimeUrl з іншим користувачем → не синхронізовано, пароль не змінено', async () => {
    const report = await applyMigrations({
      connectionString: db.url,
      dir: CANON_DIR,
      runtimeUrl: withCredentials(db.url, 'someone_else', PASSWORD),
    });
    expect(report.runtimePasswordSynced).toBe(false);
    expect(await rolpassword(harness.url, 'app_runtime')).toBe(saved);
  }, 120_000);

  it('не-ASCII пароль → відмова про алфавіт без значення, пароль не змінено', async () => {
    const password = 'Пароль-1';
    const err = await applyMigrations({
      connectionString: db.url,
      dir: CANON_DIR,
      runtimeUrl: withCredentials(db.url, 'app_runtime', password),
    }).catch((e: unknown) => e as Error);
    expect((err as Error).message).toContain('друкованих ASCII');
    expect((err as Error).message).not.toContain(password);
    expect((err as Error).message).not.toContain(encodeURIComponent(password));
    expect(await rolpassword(harness.url, 'app_runtime')).toBe(saved);
  }, 120_000);
});
