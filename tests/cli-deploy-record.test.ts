import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { CLI_INDEX, scaffoldFakeStore } from './lib/fake-core-store';

// `simplycms deploy:record get|set` (К3-Е8, Task 21, fix 1): справжній запуск CLI.
const roots: string[] = [];
afterAll(() => {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true });
});
const RECORD = {
  version: 1,
  dokploy: {
    url: 'https://dokploy.example.com',
    projectId: 'p',
    applicationId: 'a',
    postgresId: 'pg',
  },
  domain: 'shop.example.com',
  bucket: 'secret-shop',
  createdAt: '2026-10-13T10:00:00.000Z',
};
const cli = (cwd: string, args: string[], input?: string) => {
  const r = spawnSync('node', [CLI_INDEX, 'deploy:record', ...args], {
    cwd,
    input,
    encoding: 'utf8',
  });
  return { out: r.stdout, err: r.stderr, code: r.status };
};
const file = (root: string) => join(root, '.simplycms/deploy.json');

describe('deploy:record', () => {
  it('get без файла → код 3 і пояснення; set → get повертає той самий запис', async () => {
    const root = await scaffoldFakeStore('dr-roundtrip', roots);
    const missing = cli(root, ['get']);
    expect(missing.code).toBe(3);
    expect(missing.err).toContain('запису розгортання ще немає');
    expect(cli(root, ['set'], JSON.stringify(RECORD)).code).toBe(0);
    const got = cli(root, ['get']);
    expect(got.code).toBe(0);
    expect(JSON.parse(got.out)).toEqual(RECORD);
  });

  it('set з полем поза схемою → код 1, назва поля без значення, файл не змінено, tmp немає', async () => {
    const root = await scaffoldFakeStore('dr-extra', roots);
    cli(root, ['set'], JSON.stringify(RECORD));
    const before = readFileSync(file(root), 'utf8');
    const r = cli(
      root,
      ['set'],
      JSON.stringify({ ...RECORD, apiKey: 'TOPSECRET' }),
    );
    expect(r.code).toBe(1);
    expect(r.out + r.err).toContain('apiKey');
    expect(r.out + r.err).not.toContain('TOPSECRET');
    expect(readFileSync(file(root), 'utf8')).toBe(before);
    expect(readdirSync(join(root, '.simplycms'))).toEqual(['deploy.json']);
  });

  it('set зі сміттям у stdin: код 1, значення не відлунюється, файлу немає', async () => {
    const root = await scaffoldFakeStore('dr-junk', roots);
    const r = cli(root, ['set'], 'password=hunter2 {');
    expect(r.code).toBe(1);
    expect(r.out + r.err).not.toContain('hunter2');
    expect(() => readFileSync(file(root))).toThrow();
  });

  it('set з userinfo в URL — відмова без значення; успішний set не друкує значень', async () => {
    const root = await scaffoldFakeStore('dr-userinfo', roots);
    const bad = cli(
      root,
      ['set'],
      JSON.stringify({
        ...RECORD,
        dokploy: { ...RECORD.dokploy, url: 'https://u:hunter2@d.x' },
      }),
    );
    expect(bad.code).toBe(1);
    expect(bad.out + bad.err).not.toContain('hunter2');
    const ok = cli(root, ['set'], JSON.stringify(RECORD));
    expect(ok.out + ok.err).not.toContain('secret-shop');
  });

  it('get при невалідному файлі → код 1; без аргумента → код 1', async () => {
    const root = await scaffoldFakeStore('dr-bad', roots);
    cli(root, ['set'], JSON.stringify(RECORD));
    const { writeFileSync } = await import('node:fs');
    writeFileSync(file(root), '{"version":1}');
    expect(cli(root, ['get']).code).toBe(1);
    expect(cli(root, []).code).toBe(1);
  });
});
