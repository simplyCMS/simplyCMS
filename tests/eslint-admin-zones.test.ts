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

const ADMIN_TSX = 'packages/simplycms/src/admin/features/x/X.tsx';
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

describe('адмінка в зонах лінту', () => {
  it('ловить <label> без звʼязаного контролу', async () => {
    const code =
      'export const X = () => (<div><label>Імʼя</label><input /></div>);\n';
    expect(await ruleIds(code, ADMIN_TSX)).toContain(
      'jsx-a11y/label-has-associated-control',
    );
  });

  it('ловить літеральний перший сегмент queryKey', async () => {
    const code = "export const q = { queryKey: ['banners', 'all'] };\n";
    expect(await ruleIds(code, ADMIN_TSX)).toContain(QUERY_KEY_RULE);
  });
});
