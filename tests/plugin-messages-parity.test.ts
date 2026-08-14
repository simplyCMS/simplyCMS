import { describe, it, expect } from 'vitest';
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Каталог перекладів плагіна — `messages` з `definePlugin` (дзеркало
 * `ThemeModule.messages`, план Фази 3 Р6). Форма: `{ uk: {...}, en: {...} }`.
 */
interface PluginMessagesModule {
  messages: {
    uk?: Record<string, string>;
    en?: Record<string, string>;
  };
}

/**
 * Плагіни живуть у ДВОХ місцях, і обидва читаються з диска, а не списком
 * (нова тека, забута в списку, мовчки лишилася б поза перевіркою — той
 * самий аргумент, що в theme-messages-parity):
 *  - `plugins/<name>` — локальні плагіни магазину-монорепо;
 *  - `packages/simplycms-plugin-<name>` — публіковані референс-плагіни.
 */
function pluginDirs(): { name: string; dir: string }[] {
  const local = readdirSync(join(REPO_ROOT, 'plugins'), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      dir: join(REPO_ROOT, 'plugins', entry.name),
    }));

  const published = readdirSync(join(REPO_ROOT, 'packages'), {
    withFileTypes: true,
  })
    .filter(
      (entry) =>
        entry.isDirectory() && entry.name.startsWith('simplycms-plugin-'),
    )
    .map((entry) => ({
      name: entry.name.slice('simplycms-plugin-'.length),
      dir: join(REPO_ROOT, 'packages', entry.name, 'src'),
    }));

  return [...local, ...published].sort((a, b) => a.name.localeCompare(b.name));
}

async function loadMessages(
  dir: string,
): Promise<PluginMessagesModule['messages'] | null> {
  const path = join(dir, 'messages.ts');
  if (!existsSync(path)) return null;

  const mod = (await import(
    /* @vite-ignore */ pathToFileURL(path).href
  )) as PluginMessagesModule;
  return mod.messages;
}

/** Плейсхолдери `{name}` рядка, відсортовані для порівняння без урахування порядку. */
function placeholders(s: string): string {
  return (s.match(/\{(\w+)\}/g) ?? []).sort().join(',');
}

describe('каталоги перекладів плагінів (definePlugin messages)', () => {
  const plugins = pluginDirs();

  it('у репо є хоча б один плагін', () => {
    expect(plugins.length).toBeGreaterThan(0);
  });

  describe.each(plugins)('плагін "$name"', ({ name, dir }) => {
    it('якщо messages.ts існує — обидві локалі непорожні, en покриває uk 1:1', async () => {
      const messages = await loadMessages(dir);
      if (!messages) return; // Плагін без каталогу — legacy, дозволено.

      const uk = messages.uk ?? {};
      const en = messages.en ?? {};
      expect(Object.keys(uk).length).toBeGreaterThan(0);
      expect(Object.keys(en).sort()).toEqual(Object.keys(uk).sort());
    });

    it('ключі несуть префікс plugin.<name>. і непорожні значення', async () => {
      const messages = await loadMessages(dir);
      if (!messages) return;

      // Неймспейс — єдиний захист від колізій із замкненим MessageKey ядра
      // та іншими плагінами (той самий контракт, що `theme.` у тем).
      const prefix = `plugin.${name}.`;
      for (const [locale, catalog] of Object.entries(messages)) {
        for (const [key, text] of Object.entries(catalog ?? {})) {
          expect(key, `${locale}: ${key}`).toMatch(
            new RegExp(`^${prefix.replace(/[.]/g, '\\.')}`),
          );
          expect(text.trim(), `${locale}: ${key} порожній`).not.toBe('');
        }
      }
    });

    it('плейсхолдери {param} збігаються між локалями', async () => {
      const messages = await loadMessages(dir);
      if (!messages?.uk || !messages?.en) return;

      for (const key of Object.keys(messages.uk)) {
        expect(
          placeholders(messages.en[key] ?? ''),
          `плейсхолдери "${key}" розійшлися`,
        ).toBe(placeholders(messages.uk[key]));
      }
    });
  });
});
