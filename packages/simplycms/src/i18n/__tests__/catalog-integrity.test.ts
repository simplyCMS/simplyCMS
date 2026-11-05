import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { UiCatalogPart } from '../types';

const CATALOGS = join(dirname(fileURLToPath(import.meta.url)), '../catalogs');

/**
 * Частини каталогу = розкладка на диску: `admin/` — частина `admin`, `mail.ts` — `mail`,
 * решта — `base`. Модулі неймспейсів читаються з диска, а не перелічуються списком:
 * інакше новий модуль, забутий у списку, мовчки лишився б поза перевіркою — тобто тест
 * охороняв би рівно ті файли, що й так у порядку.
 *
 * Вкладеність — рівно один рівень (`admin/products.ts` → неймспейс `admin.products`):
 * адмінка має надто багато ключів для плоского файлу під лімітом 150 рядків.
 */
const PARTS: readonly UiCatalogPart[] = ['base', 'admin', 'mail'];

function partOf(file: string): UiCatalogPart {
  if (file.startsWith('admin/')) return 'admin';
  return file === 'mail.ts' ? 'mail' : 'base';
}

function namespaceModules(locale: 'uk' | 'en'): string[] {
  const root = join(CATALOGS, locale);
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      for (const nested of readdirSync(join(root, entry.name))) {
        if (nested.endsWith('.ts') && nested !== 'index.ts') {
          out.push(`${entry.name}/${nested}`);
        }
      }
    } else if (entry.name.endsWith('.ts') && !isAggregate(entry.name)) {
      out.push(entry.name);
    }
  }
  return out.sort();
}

/** Зведення частини (`base.ts`) — не модуль неймспейсу. */
function isAggregate(name: string): boolean {
  return name === 'index.ts' || name === 'base.ts';
}

/** `admin/products.ts` → `admin.products`; `cart.ts` → `cart`. */
function namespaceOf(file: string): string {
  return file.replace(/\.ts$/, '').replace(/\//g, '.');
}

async function loadModuleKeys(locale: 'uk' | 'en', file: string) {
  const url = pathToFileURL(join(CATALOGS, locale, file)).href;
  const mod = (await import(/* @vite-ignore */ url)) as {
    messages: Record<string, string>;
  };
  return Object.keys(mod.messages);
}

async function loadPart(locale: 'uk' | 'en', part: UiCatalogPart) {
  const file = part === 'admin' ? 'admin/index' : part;
  const url = pathToFileURL(join(CATALOGS, locale, `${file}.ts`)).href;
  const mod = (await import(/* @vite-ignore */ url)) as {
    messages: Record<string, string>;
  };
  return mod.messages;
}

describe.each(['uk', 'en'] as const)('каталог %s — цілісність', (locale) => {
  describe.each(PARTS)('частина %s', (part) => {
    const files = () =>
      namespaceModules(locale).filter((f) => partOf(f) === part);

    it('жоден ключ не перетерся при spread-і модулів', async () => {
      const perModule = await Promise.all(
        files().map((f) => loadModuleKeys(locale, f)),
      );
      const declared = perModule.reduce((sum, keys) => sum + keys.length, 0);

      // 🔴 Суть перевірки: `{...a, ...b}` перетирає збіг ключів МОВЧКИ, тож
      // розбіжність тут означає дублікат ключа у двох неймспейсах.
      expect(Object.keys(await loadPart(locale, part))).toHaveLength(declared);
    });

    it('усі модулі частини підключено у зведення', async () => {
      const catalog = await loadPart(locale, part);
      const perModule = await Promise.all(
        files().map((f) => loadModuleKeys(locale, f)),
      );
      const orphaned = perModule.flat().filter((key) => !(key in catalog));

      expect(orphaned, `ключі модулів, яких немає у частині`).toEqual([]);
    });

    it('ключі модуля мають префікс свого неймспейсу', async () => {
      for (const file of files()) {
        const namespace = namespaceOf(file);
        const keys = await loadModuleKeys(locale, file);
        const misplaced = keys.filter((k) => !k.startsWith(`${namespace}.`));

        expect(misplaced, `${locale}/${file}: ключі чужого неймспейсу`).toEqual(
          [],
        );
      }
    });
  });
});

describe('розкладка модулів uk і en збігається', () => {
  it('однаковий набір файлів неймспейсів', () => {
    expect(namespaceModules('en')).toEqual(namespaceModules('uk'));
  });
});
