import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveOptions } from '../packages/create-simplycms-store/src/args.mjs';
import {
  renderManifest,
  scaffold,
} from '../packages/create-simplycms-store/src/scaffold.mjs';

// Чисті функції CLI-скаффолдера: розбір аргументів, підстановки в манифест,
// розгортання шаблону. Ті самі функції викликає `src/index.mjs`.
describe('create-store CLI', () => {
  it('resolveOptions: прапорці перекривають промпти; CI ⇒ yes', () => {
    const o = resolveOptions(
      [
        'my-shop',
        '--supabase-url',
        'https://x.supabase.co',
        '--supabase-key',
        'sb_pk',
        '--no-install',
        '--no-git',
      ],
      { CI: 'true' },
      false,
    );
    expect(o).toMatchObject({
      storeName: 'my-shop',
      supabaseUrl: 'https://x.supabase.co',
      supabaseKey: 'sb_pk',
      install: false,
      git: false,
      yes: true,
    });
  });

  it('resolveOptions: значення прапорця не з’їдає позиційний аргумент', () => {
    const o = resolveOptions(
      ['--supabase-url', 'https://x.supabase.co', '../shops/my-shop'],
      {},
      true,
    );
    expect(o.storeName).toBe('../shops/my-shop');
    expect(o.supabaseUrl).toBe('https://x.supabase.co');
    expect(o.yes).toBe(false);
    expect(o.install).toBe(true);
    expect(o.git).toBe(true);
  });

  it('resolveOptions: невідомий прапорець — помилка', () => {
    expect(() => resolveOptions(['--wat'], {}, true)).toThrow(/--wat/);
  });

  it('renderManifest підставляє імʼя і версію в усі @simplycms/*', () => {
    const tpl =
      '{"name":"__STORE_NAME__","dependencies":{"@simplycms/ui":"__SIMPLYCMS_VERSION__"}}';
    const out = JSON.parse(
      renderManifest(tpl, { storeName: 'shop', version: '0.1.0' }),
    );
    expect(out.name).toBe('shop');
    expect(out.dependencies['@simplycms/ui']).toBe('0.1.0');
  });

  it('scaffold: перейменовує tpl/gitignore/env.example і пише .env.local', async () => {
    const target = join(mkdtempSync(join(tmpdir(), 'css-')), 'demo');
    await scaffold({
      templateDir: 'packages/create-simplycms-store/template',
      targetDir: target,
      storeName: 'demo',
      version: '0.1.0',
      supabaseUrl: 'https://x.supabase.co',
      supabaseKey: 'sb_pk',
    });
    expect(existsSync(join(target, 'package.json'))).toBe(true);
    expect(existsSync(join(target, '.gitignore'))).toBe(true);
    expect(existsSync(join(target, '.env.example'))).toBe(true);
    expect(existsSync(join(target, 'package.json.tpl'))).toBe(false);
    expect(readFileSync(join(target, '.env.local'), 'utf8')).toContain(
      'VITE_SUPABASE_URL=https://x.supabase.co',
    );
    expect(
      JSON.parse(readFileSync(join(target, 'package.json'), 'utf8')).name,
    ).toBe('demo');
  });

  it('scaffold: без ключів Supabase .env.local не створюється', async () => {
    const target = join(mkdtempSync(join(tmpdir(), 'css-')), 'demo');
    await scaffold({
      templateDir: 'packages/create-simplycms-store/template',
      targetDir: target,
      storeName: 'demo',
      version: '0.1.0',
    });
    expect(existsSync(join(target, '.env.local'))).toBe(false);
    expect(existsSync(join(target, '.env.example'))).toBe(true);
  });
});
