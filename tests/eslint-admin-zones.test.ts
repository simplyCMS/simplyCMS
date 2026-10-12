import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Негативний контроль: адмінка (`src/admin/**`) — у зонах доступних імен і
 * ключів кешу з реєстру (К3-Е7 зняв виїмку разом із легасі-шаром).
 *
 * 🔴 Зелений `pnpm lint` не доводить, що тека в зоні: тека, що мовчки випала
 * з `files`, теж дає зелений лінт. Тут ESLint отримує синтетичне порушення з
 * filePath усередині адмінки.
 */

// 🔴 Усі теки адмінки, а не одна: звуження зони до `admin/features/**` лишало
// тест зеленим, хоча решта теки випадала з лінту.
const ADMIN_DIRS = ['components', 'pages', 'layouts', 'lib', 'features'];
const adminFile = (dir: string, ext: 'ts' | 'tsx'): string =>
  `packages/simplycms/src/admin/${dir}/x/X.${ext}`;
// Ім'я правила лінту: audit-exports бере специфікатори лише з імпорт-форм,
// тож літерал тут субшляхом пакета не вважається.
const QUERY_KEY_RULE = 'simplycms/query-key-from-entity';

let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({ cwd: REPO });
});

async function ruleIds(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, {
    filePath: join(REPO, filePath),
    warnIgnored: true,
  });
  return result.messages.map((m) => m.ruleId ?? `<${m.message}>`);
}

describe.each(ADMIN_DIRS)('адмінка в зонах лінту: admin/%s', (dir) => {
  it('ловить <label> без звʼязаного контролу (.tsx)', async () => {
    const code =
      'export const X = () => (<div><label>Імʼя</label><input /></div>);\n';
    expect(await ruleIds(code, adminFile(dir, 'tsx'))).toContain(
      'jsx-a11y/label-has-associated-control',
    );
  });

  it.each(['ts', 'tsx'] as const)(
    'ловить літеральний перший сегмент queryKey (.%s)',
    async (ext) => {
      const code = "export const q = { queryKey: ['banners', 'all'] };\n";
      expect(await ruleIds(code, adminFile(dir, ext))).toContain(
        QUERY_KEY_RULE,
      );
    },
  );
});
