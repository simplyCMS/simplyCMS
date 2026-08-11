import { describe, it, expect } from 'vitest';
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const THEMES_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../themes');

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
 * Теми читаються з диска, а не перелічуються списком: інакше нова тема,
 * забута в списку, мовчки лишилася б поза перевіркою — рівно той самий
 * аргумент, що й для неймспейс-модулів у `catalog-integrity.test.ts`.
 */
function themeDirs(): string[] {
  return readdirSync(THEMES_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function loadThemeMessages(
  themeName: string,
): Promise<ThemeMessagesModule['messages'] | null> {
  const path = join(THEMES_ROOT, themeName, 'messages.ts');
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

  describe.each(themes)('тема "%s"', (themeName) => {
    it('якщо messages.ts існує — обидві локалі непорожні, en покриває uk 1:1', async () => {
      const messages = await loadThemeMessages(themeName);
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
        `неперекладені ключі теми "${themeName}" (${missing.length})`,
      ).toEqual([]);

      const extra = enKeys.filter((k) => !(k in uk));
      expect(extra, `en-ключі теми "${themeName}", яких немає в uk`).toEqual(
        [],
      );
    });

    it('жодне повідомлення теми не порожнє', async () => {
      const messages = await loadThemeMessages(themeName);
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
      const messages = await loadThemeMessages(themeName);
      if (!messages) return;

      const uk = messages.uk ?? {};
      const en = messages.en ?? {};
      const mismatched = Object.keys(uk)
        .filter((k) => k in en)
        .filter((k) => placeholders(uk[k]!) !== placeholders(en[k]!));

      expect(
        mismatched,
        `теми "${themeName}": розбіжність плейсхолдерів`,
      ).toEqual([]);
    });

    it('усі ключі теми мають префікс "theme."', async () => {
      // Захист від колізії з `MessageKey` ядра: `useThemeT` фолбечить на
      // `messages['uk'][key] → key`, і ключ без префікса міг би візуально
      // збігтися з майбутнім core-ключем.
      const messages = await loadThemeMessages(themeName);
      if (!messages) return;

      const uk = messages.uk ?? {};
      const misplaced = Object.keys(uk).filter((k) => !k.startsWith('theme.'));

      expect(
        misplaced,
        `теми "${themeName}": ключі без префікса "theme."`,
      ).toEqual([]);
    });
  });
});
