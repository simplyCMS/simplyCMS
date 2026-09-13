import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { importProtection } from 'simplycms/contracts/server-only';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Гейт підключення Import Protection (трек T; переписаний К2-Е0, T-1).
 *
 * 🔴 Попередня версія перевіряла ТЕКСТ трьох конфігів неанкерованими
 * регексами — і зеленіла на закоментованому блоці та на `enabled: false`
 * (штатна опція Start, яка вимикає плагін цілком). Тепер дві половини:
 *   1. ДАНІ — сам обʼєкт, який конфіги передають плагіну, перевіряється
 *      викликом хелпера декларації, а не читанням файлу;
 *   2. ТЕКСТ — рівно один анкерований рядок на конфіг: конфіг передає саме
 *      цей обʼєкт і не має поруч `enabled:`.
 * Поведінку (що збірка справді падає) доводить Gate IP пілота — `pnpm
 * pilot:pack`, у CI job `packaging`.
 */

const CONFIGS = [
  [
    'хост',
    'vite.config.ts',
    './packages/simplycms/src/contracts/server-only.ts',
  ],
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

describe('Import Protection: дані декларації', () => {
  const options = importProtection();

  it('режим error, усі імпортери, жодного enabled', () => {
    expect(options.behavior).toBe('error');
    expect(options.include).toEqual(['**']);
    // 🔴 Відсутність ключа, а не `enabled !== false`: `enabled: undefined`
    // теж читається плагіном як «увімкнено», але ключ у обʼєкті — сигнал,
    // що хтось уже торкався перемикача.
    expect('enabled' in options).toBe(false);
  });

  it('client: три набори, і files несе дефолт Start вручну', () => {
    const client = options.client!;
    expect(client.specifiers!.length).toBeGreaterThanOrEqual(2);
    expect(client.files).toContain('**/*.server.*');
    expect(client.files!.length).toBe(2);
    expect(client.excludeFiles!.length).toBe(1);
  });

  it('specifiers ловлять server-only субшляхи й серверні залежності, пускають клієнтське', () => {
    const rx = (client: NonNullable<typeof options.client>) =>
      client.specifiers!.filter((p): p is RegExp => p instanceof RegExp);
    const denied = (s: string) => rx(options.client!).some((r) => r.test(s));
    expect(denied('simplycms/db')).toBe(true);
    expect(denied('simplycms/storefront/loaders')).toBe(true);
    expect(denied('simplycms/admin-server/impl')).toBe(true);
    expect(denied('better-auth')).toBe(true);
    expect(denied('better-auth/reactor')).toBe(true);
    expect(denied('better-auth/react')).toBe(false);
    expect(denied('simplycms/ui')).toBe(false);
    expect(denied('simplycms/admin-server')).toBe(false);
  });

  it('files ловлять server-only дерева і в src, і в dist; excludeFiles пускає лише ядро з node_modules', () => {
    const files = options.client!.files!.filter(
      (p): p is RegExp => p instanceof RegExp,
    );
    const deniedFile = (s: string) => files.some((r) => r.test(s));
    expect(deniedFile('packages/simplycms/src/db/index.ts')).toBe(true);
    expect(
      deniedFile(
        'node_modules/.pnpm/simplycms@0.4.1/node_modules/simplycms/dist/auth/index.js',
      ),
    ).toBe(true);
    expect(deniedFile('packages/simplycms/src/ui/button.tsx')).toBe(false);
    expect(deniedFile('packages/simplycms-theme-solarstore/src/index.ts')).toBe(
      false,
    );

    const [exclude] = options.client!.excludeFiles as RegExp[];
    expect(exclude.test('node_modules/react/index.js')).toBe(true);
    expect(
      exclude.test(
        'node_modules/.pnpm/simplycms@0.4.1/node_modules/simplycms/src/db/client.ts',
      ),
    ).toBe(false);
  });
});

describe.each(CONFIGS)(
  'Import Protection у конфізі: %s',
  (_l, file, specifier) => {
    const source = readFileSync(join(REPO, file), 'utf8');

    it('імпортує рівно хелпер importProtection з декларації', () => {
      const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expect(source).toMatch(
        new RegExp(`^import \\{ importProtection \\} from '${escaped}';$`, 'm'),
      );
    });

    it('передає обʼєкт декларації одним анкерованим рядком і не чіпає enabled', () => {
      // 🔴 Анкер `^\s*` — щоб `// importProtection: …` (закоментований) не
      // рахувався; `enabled:` у будь-якій формі — червоне.
      expect(source).toMatch(/^\s*importProtection: importProtection\(\),$/m);
      expect(source).not.toMatch(/^\s*enabled\s*:/m);
    });
  },
);
