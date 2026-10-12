import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadEnvFiles } from '../packages/create-simplycms-store/template/scripts/owner-invite-env.mjs';

// К1: `owner:invite` наповнює env з `.env.local`/`.env` так само, як
// `server.mjs` (штатний `parseEnv`), а не власним циклом, що лишав лапки,
// коментарі в кінці рядка й префікс `export`. Реальної БД тут немає.

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

  // `owner-invite.mjs` тягне `simplycms/db` (пакет у юніті не зібраний), тож
  // запуск дочірнім процесом неможливий; стережемо проводку статично: скрипт
  // обов'язково кличе спільний завантажувач і не має власного розбору файлів.
  it('owner-invite.mjs кличе спільний завантажувач і не має власного циклу', () => {
    const script = readFileSync(
      'packages/create-simplycms-store/template/scripts/owner-invite.mjs',
      'utf8',
    );
    expect(script).toMatch(
      /import \{ loadEnvFiles \} from '\.\/owner-invite-env\.mjs';/,
    );
    expect(script).toMatch(/^loadEnvFiles\(\);$/m);
    expect(script).not.toMatch(/readFileSync|split\(/);
  });
});
