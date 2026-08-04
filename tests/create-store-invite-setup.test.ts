import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { printNextSteps } from '../packages/create-simplycms-store/src/steps.mjs';

// Лінк у листі-запрошенні GoTrue будує з `{{ .SiteURL }}`, а `owner:invite`
// свідомо НЕ передає `redirectTo`. Отже адреса листа = Site URL проєкту, і
// вона мусить збігатися з тим, де магазин реально піднімається. Два місця, де
// це може розсинхронитись, і обидва — не код, а інструкція користувачу.
const TEMPLATE = 'packages/create-simplycms-store/template';
const read = (p: string) => readFileSync(p, 'utf8');

describe('create-store: адреса з листа-запрошення', () => {
  // `supabase db push` накочує лише міграції — секція `[auth]` локального
  // config.toml на хмару не їде, а її `site_url` збігається з дефолтом нового
  // проєкту (localhost:3000), тож і діфа не буде. Крок у Dashboard обовʼязковий.
  it('README вимагає виставити Site URL у Dashboard', () => {
    const readme = read(`${TEMPLATE}/README.md`);
    expect(readme).toMatch(/URL Configuration/);
    expect(readme).toMatch(/Site URL/);
    expect(readme).toMatch(/Redirect URLs/);
    // Згадка `supabase config push` без застереження — пастка: він відправляє
    // ВЕСЬ конфіг і затирає віддалені auth-налаштування дефолтами CLI.
    if (readme.includes('supabase config push')) {
      expect(readme).toMatch(/весь|ВЕСЬ/);
      expect(readme).toMatch(/перезапи/i);
    }
  });

  it('printNextSteps друкує той самий крок', () => {
    let out = '';
    const spy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: unknown) => {
        out += String(chunk);
        return true;
      });
    try {
      printNextSteps({
        dirLabel: 'my-shop',
        installed: true,
        hasEnv: true,
      });
    } finally {
      spy.mockRestore();
    }
    expect(out).toContain('URL Configuration');
    expect(out).toContain('Site URL');
    expect(out).toContain('Redirect URLs');
    expect(out).toContain('Email Templates');
  });

  // Dev-сервер магазину мусить слухати той самий порт, що `site_url` у
  // config.toml і що `server.mjs` (PORT=3000). Дефолт Vite — 5173.
  it('dev-порт шаблону = порт site_url і server.mjs', () => {
    const port = /site_url = "http:\/\/localhost:(\d+)"/.exec(
      read(`${TEMPLATE}/supabase/config.toml`),
    )?.[1];
    expect(port).toBe('3000');
    for (const config of [
      `${TEMPLATE}/vite.config.ts`,
      'tests/pilot/store-template/vite.config.ts',
    ]) {
      expect(read(config)).toMatch(
        new RegExp(`server: \\{ port: ${port}, strictPort: true \\}`),
      );
    }
  });
});
