import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadEnvFiles } from '../env-files';
import { ownerInviteMain } from '../main';

// К1: `owner:invite` (ядро, `simplycms/auth/owner-invite-cli`) наповнює env з
// `.env.local`/`.env` так само, як `server.mjs` (штатний `parseEnv`), а не
// власним циклом, що лишав лапки, коментарі в кінці рядка й префікс `export`.
// Реальної БД тут немає.

describe('owner-invite: наповнення env з файлів (К1)', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true });
  });
  const setup = (files: Record<string, string>) => {
    const dir = mkdtempSync(join(tmpdir(), 'owner-invite-env-'));
    dirs.push(dir);
    for (const [name, body] of Object.entries(files))
      writeFileSync(join(dir, name), body);
    return ['.env.local', '.env'].map((name) => join(dir, name));
  };

  it('лапки, коментар у кінці рядка й `export` розібрано, як у server.mjs', () => {
    const files = setup({
      '.env.local': [
        'DATABASE_URL="postgres://u:p@h:5432/db"',
        'VITE_SITE_URL=http://localhost:3000 # коментар',
        'export OWNER_EMAIL=me@example.com',
      ].join('\n'),
    });
    const env: Record<string, string | undefined> = {};
    loadEnvFiles(env, files);
    expect(env).toEqual({
      DATABASE_URL: 'postgres://u:p@h:5432/db',
      VITE_SITE_URL: 'http://localhost:3000',
      OWNER_EMAIL: 'me@example.com',
    });
  });

  it('реальний env процесу перемагає файли, `.env.local` перемагає `.env`', () => {
    const files = setup({
      '.env.local': 'A=local\nB=local',
      '.env': 'A=base\nB=base\nC=base',
    });
    const env: Record<string, string | undefined> = { A: 'process' };
    loadEnvFiles(env, files);
    expect(env).toEqual({ A: 'process', B: 'local', C: 'base' });
  });

  it('відсутні файли — норма', () => {
    const env: Record<string, string | undefined> = {};
    loadEnvFiles(env, [join(tmpdir(), 'owner-invite-env-none', '.env')]);
    expect(env).toEqual({});
  });

  // Проводка `ownerInviteMain` (шим магазину кличе лише її): env наповнюється з
  // файлів ДО перевірки обов'язкових ключів. Ключ, що є лише у `.env.local`, не
  // потрапляє в список відсутніх — і до БД справа не доходить (бракує сайту).
  it('ownerInviteMain наповнює env з файлів до перевірки ключів', async () => {
    const files = setup({
      '.env.local': 'DATABASE_URL=postgres://u:p@h/db\nOWNER_EMAIL=me@x.test',
    });
    const env: Record<string, string | undefined> = {};
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(await ownerInviteMain([], { env, files })).toBe(1);
      const printed = error.mock.calls.map((c) => String(c[0])).join('\n');
      expect(printed).toContain('Потрібні змінні оточення: VITE_SITE_URL ');
    } finally {
      error.mockRestore();
    }
    expect(env.OWNER_EMAIL).toBe('me@x.test');
  });

  // Шим магазину — кілька рядків без власної логіки: уся проводка в ядрі.
  it('шим scripts/owner-invite.mjs лише кличе ownerInviteMain', () => {
    const shim = readFileSync(
      'packages/create-simplycms-store/template/scripts/owner-invite.mjs',
      'utf8',
    );
    expect(shim).toMatch(
      /import \{ ownerInviteMain \} from 'simplycms\/auth\/owner-invite-cli';/,
    );
    expect(shim).toMatch(
      /^process\.exitCode = await ownerInviteMain\(process\.argv\.slice\(2\)\);$/m,
    );
    expect(shim).not.toMatch(/readFileSync|parseEnv|split\(/);
  });
});
