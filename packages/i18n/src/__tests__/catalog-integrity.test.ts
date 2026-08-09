import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { messages as ukMessages } from '../catalogs/uk/index';
import { messages as enMessages } from '../catalogs/en/index';

const CATALOGS = join(dirname(fileURLToPath(import.meta.url)), '../catalogs');

/**
 * Модулі неймспейсів читаються з диска, а не перелічуються списком: інакше
 * новий модуль, забутий у списку, мовчки лишився б поза перевіркою — тобто тест
 * охороняв би рівно ті файли, що й так у порядку.
 */
function namespaceModules(locale: 'uk' | 'en'): string[] {
  return readdirSync(join(CATALOGS, locale))
    .filter((f) => f.endsWith('.ts') && f !== 'index.ts')
    .sort();
}

async function loadModuleKeys(locale: 'uk' | 'en', file: string) {
  const url = pathToFileURL(join(CATALOGS, locale, file)).href;
  const mod = (await import(/* @vite-ignore */ url)) as {
    messages: Record<string, string>;
  };
  return Object.keys(mod.messages);
}

describe.each(['uk', 'en'] as const)('каталог %s — цілісність', (locale) => {
  const catalog = locale === 'uk' ? ukMessages : enMessages;

  it('жоден ключ не перетерся при spread-і модулів', async () => {
    const perModule = await Promise.all(
      namespaceModules(locale).map((f) => loadModuleKeys(locale, f)),
    );
    const declared = perModule.reduce((sum, keys) => sum + keys.length, 0);

    // 🔴 Суть перевірки: `{...a, ...b}` перетирає збіг ключів МОВЧКИ, тож
    // розбіжність тут означає дублікат ключа у двох неймспейсах.
    expect(Object.keys(catalog)).toHaveLength(declared);
  });

  it('усі модулі підключено в index.ts', async () => {
    const perModule = await Promise.all(
      namespaceModules(locale).map((f) => loadModuleKeys(locale, f)),
    );
    const orphaned = perModule
      .flat()
      .filter((key) => !(key in (catalog as Record<string, string>)));

    expect(orphaned, `ключі модулів, яких немає у зведеному каталозі`).toEqual(
      [],
    );
  });

  it('ключі модуля мають префікс свого неймспейсу', async () => {
    for (const file of namespaceModules(locale)) {
      const namespace = file.replace(/\.ts$/, '');
      const keys = await loadModuleKeys(locale, file);
      const misplaced = keys.filter((k) => !k.startsWith(`${namespace}.`));

      expect(misplaced, `${locale}/${file}: ключі чужого неймспейсу`).toEqual(
        [],
      );
    }
  });
});

describe('розкладка модулів uk і en збігається', () => {
  it('однаковий набір файлів неймспейсів', () => {
    expect(namespaceModules('en')).toEqual(namespaceModules('uk'));
  });
});
