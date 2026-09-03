import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Гейт ПІДКЛЮЧЕННЯ Import Protection у трьох vite-конфігах (трек T).
 *
 * 🔴 Без цього тесту видалення будь-якого з трьох рядків `client` пройшло б
 * ЗЕЛЕНО: parity-тест шаблону ловить лише розходження шаблон↔пілот (обидва
 * зникли б синхронно), хост ні з чим не звіряється, а Gate C сканує чанки
 * скретча, у якому витоку немає. Тобто механізм тримався б на ручному
 * прогоні — а він не відтворюваний.
 *
 * Перевіряється саме ПІДКЛЮЧЕННЯ (текст конфігу), не поведінка: поведінку
 * патернів доводять фікстури декларації та її читачів. Той самий прийом, що в
 * `tests/create-store-template-parity.test.ts`, — конфіги виконуються лише
 * всередині Vite, тож імпортувати їх тут нічим.
 */

const CONFIGS = [
  ['хост', 'vite.config.ts', './packages/simplycms/src/contracts/server-only'],
  [
    'шаблон магазину',
    'packages/create-simplycms-store/template/vite.config.ts',
    'simplycms/contracts/server-only',
  ],
  [
    'оверлей пілота',
    'tests/pilot/store-template/vite.config.ts',
    'simplycms/contracts/server-only',
  ],
] as const;

/**
 * Три набори патернів `client` — кожен ЛИШЕ викликом хелпера декларації.
 * Літеральний масив чи власний regex на цьому місці означав би другу копію
 * межі, а весь трек T саме її й ліквідовує.
 */
const CLIENT_RULES = [
  ['specifiers', /\bspecifiers:\s*serverOnlySpecifiers\(\),/],
  ['files', /\bfiles:\s*serverOnlyFiles\(\),/],
  ['excludeFiles', /\bexcludeFiles:\s*serverOnlyExcludeFiles\(\),/],
] as const;

describe.each(CONFIGS)(
  'Import Protection у конфізі: %s',
  (_label, file, specifier) => {
    const source = readFileSync(join(REPO, file), 'utf8');

    it('вантажить усі три хелпери саме з декларації межі', () => {
      const importBlock = new RegExp(
        `import \\{([^}]*)\\} from '${specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}';`,
      ).exec(source);
      expect(
        importBlock,
        `${file}: імпорту з ${specifier} немає`,
      ).not.toBeNull();
      const names = (importBlock?.[1] ?? '')
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean);
      expect(names.sort()).toEqual([
        'serverOnlyExcludeFiles',
        'serverOnlyFiles',
        'serverOnlySpecifiers',
      ]);
    });

    it('вмикає перевірку в режимі error і на ВСІХ імпортерах', () => {
      // `include: ['**']` не косметика: за замовчуванням перевіряються лише
      // імпортери в `src/`, тож теми, плагіни й сам пакет ядра в node_modules
      // лишились би поза перевіркою — і гейт зеленів би вхолосту.
      expect(source).toMatch(/importProtection:\s*\{/);
      expect(source).toMatch(/\bbehavior:\s*'error',/);
      expect(source).toMatch(/\binclude:\s*\['\*\*'\],/);
    });

    it.each(CLIENT_RULES)(
      'client.%s — виклик хелпера декларації',
      (_name, rx) => {
        expect(rx.test(source), `${file}: ${rx}`).toBe(true);
      },
    );
  },
);
