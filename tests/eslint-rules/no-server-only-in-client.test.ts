import { describe, expect, it } from 'vitest';
import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import rule from '../../eslint-rules/no-server-only-in-client.mjs';

// 🔴 Парсер — саме `tseslint.parser`, не дефолтний espree: `import type` і
// inline `type`-специфікатори — синтаксис TypeScript, espree на ньому падає
// fatal-помилкою парсингу (побачено на першому прогоні цього файлу).
const linter = new Linter();
const lint = (code: string) =>
  linter.verify(code, {
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2024,
      sourceType: 'module',
    },
    plugins: { s: { rules: { 'no-server-only-in-client': rule } } },
    rules: { 's/no-server-only-in-client': 'error' },
  });

describe('no-server-only-in-client', () => {
  it.each([
    [
      'значення з server-only субшляху',
      "import { withActor } from 'simplycms/db';",
    ],
    [
      'змішаний специфікатор — емітить через значення',
      "import { a, type B } from 'simplycms/db';",
    ],
    ['side-effect import емітить сам по собі', "import 'simplycms/db';"],
    ['ре-експорт емітить', "export { x } from 'simplycms/auth';"],
    ['серверна залежність', "import { drizzle } from 'drizzle-orm';"],
  ])('валить: %s', (_l, code) => expect(lint(code)).toHaveLength(1));

  it.each([
    // 🔴 ЦЕЙ кейс — причина існування правила в такій формі. Реальний рядок
    // `admin/pages/OrderStatuses.tsx:8`; якби гейт його валив, він заборонив
    // би канон Е1а.
    [
      'import type стирається компілятором',
      "import type { OrderStatus } from 'simplycms/schema/types';",
    ],
    [
      'inline type-специфікатор теж',
      "import { type OrderStatus } from 'simplycms/schema/types';",
    ],
    ['клієнтський субшлях', "import { Button } from 'simplycms/ui/button';"],
    [
      'clientSafe-підшлях залежності',
      "import { useSession } from 'better-auth/react';",
    ],
    [
      'стаб admin-server — клієнту легальний',
      "import { listOrderStatuses } from 'simplycms/admin-server';",
    ],
  ])('не валить: %s', (_l, code) => expect(lint(code)).toHaveLength(0));
});
