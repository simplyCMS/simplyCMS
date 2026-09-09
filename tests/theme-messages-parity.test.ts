import { describe, it, expect } from 'vitest';
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Каталог перекладів теми — `ThemeModule.messages` (опційне поле, контракт
 * v2 §12). Форма: `{ uk: {...}, en: {...} }`.
 */
interface ThemeMessagesModule {
  messages: {
    uk?: Record<string, string>;
    en?: Record<string, string>;
  };
}

/**
 * Теми живуть у ДВОХ коренях, і обидва читаються з диска, а не списком:
 * інакше нова тема, забута в списку, мовчки лишилася б поза перевіркою —
 * рівно той самий аргумент, що й для неймспейс-модулів у
 * `catalog-integrity.test.ts`.
 *
 * 🔴 Форма шляху до каталогу в них РІЗНА, тож прописується явно:
 *  - `themes/<name>/messages.ts` — локальна/copy-in-тема магазину;
 *  - `packages/simplycms-theme-<name>/src/messages.ts` — референс-пакет
 *    (Фаза 4).
 */
function themeDirs(): { name: string; dir: string }[] {
  const local = readdirSync(join(REPO_ROOT, 'themes'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      dir: join(REPO_ROOT, 'themes', entry.name),
    }));

  const published = readdirSync(join(REPO_ROOT, 'packages'), {
    withFileTypes: true,
  })
    .filter(
      (entry) =>
        entry.isDirectory() && entry.name.startsWith('simplycms-theme-'),
    )
    .map((entry) => ({
      name: entry.name.slice('simplycms-theme-'.length),
      dir: join(REPO_ROOT, 'packages', entry.name, 'src'),
    }));

  return [...local, ...published].sort((a, b) => a.name.localeCompare(b.name));
}

async function loadThemeMessages(
  dir: string,
): Promise<ThemeMessagesModule['messages'] | null> {
  const path = join(dir, 'messages.ts');
  if (!existsSync(path)) return null;

  const mod = (await import(
    /* @vite-ignore */ pathToFileURL(path).href
  )) as ThemeMessagesModule;
  return mod.messages;
}

/** Плейсхолдери `{name}` рядка, відсортовані для порівняння без урахування порядку. */
function placeholders(s: string): string {
  return (s.match(/\{(\w+)\}/g) ?? []).sort().join(',');
}

describe('каталоги перекладів тем (ThemeModule.messages)', () => {
  const themes = themeDirs();

  // 🔴 Не робимо `it.skip`, якщо тем не знайдено: порожній `themes/` — це
  // помилка конфігурації репо, а не законний стан, вартий мовчазного проходу.
  it('у репо є хоча б одна тема', () => {
    expect(themes.length).toBeGreaterThan(0);
  });

  describe.each(themes)('тема "$name"', ({ name, dir }) => {
    it('якщо messages.ts існує — обидві локалі непорожні, en покриває uk 1:1', async () => {
      const messages = await loadThemeMessages(dir);
      if (!messages) {
        // Поле опційне: тема без власного каталогу — валідна (fallback
        // ланцюжок `useThemeT` віддасть сам ключ).
        return;
      }

      const uk = messages.uk ?? {};
      const en = messages.en ?? {};
      const ukKeys = Object.keys(uk).sort();
      const enKeys = Object.keys(en).sort();

      expect(
        Object.keys(uk).length,
        'messages.uk не може бути порожнім',
      ).toBeGreaterThan(0);

      const missing = ukKeys.filter((k) => !(k in en));
      expect(
        missing,
        `неперекладені ключі теми "${name}" (${missing.length})`,
      ).toEqual([]);

      const extra = enKeys.filter((k) => !(k in uk));
      expect(extra, `en-ключі теми "${name}", яких немає в uk`).toEqual([]);
    });

    it('жодне повідомлення теми не порожнє', async () => {
      const messages = await loadThemeMessages(dir);
      if (!messages) return;

      const uk = messages.uk ?? {};
      const en = messages.en ?? {};
      const empty = [
        ...Object.keys(uk).filter((k) => !uk[k]?.trim()),
        ...Object.keys(en).filter((k) => !en[k]?.trim()),
      ];

      expect(empty).toEqual([]);
    });

    it('плейсхолдери uk і en збігаються', async () => {
      const messages = await loadThemeMessages(dir);
      if (!messages) return;

      const uk = messages.uk ?? {};
      const en = messages.en ?? {};
      const mismatched = Object.keys(uk)
        .filter((k) => k in en)
        .filter((k) => placeholders(uk[k]!) !== placeholders(en[k]!));

      expect(mismatched, `теми "${name}": розбіжність плейсхолдерів`).toEqual(
        [],
      );
    });

    it('усі ключі теми мають префікс "theme."', async () => {
      // Захист від колізії з `MessageKey` ядра: `useThemeT` фолбечить на
      // `messages['uk'][key] → key`, і ключ без префікса міг би візуально
      // збігтися з майбутнім core-ключем.
      const messages = await loadThemeMessages(dir);
      if (!messages) return;

      const uk = messages.uk ?? {};
      const misplaced = Object.keys(uk).filter((k) => !k.startsWith('theme.'));

      expect(misplaced, `теми "${name}": ключі без префікса "theme."`).toEqual(
        [],
      );
    });
  });
});
