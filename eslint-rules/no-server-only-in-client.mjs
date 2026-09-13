import {
  SERVER_ONLY,
  SERVER_ONLY_DEPS,
  serverOnlyDepSpecifier,
} from '../packages/simplycms/src/contracts/server-only.ts';

/**
 * Клієнтська тека ядра не імпортує server-only субшлях чи серверну
 * залежність. Сьомий читач ЄДИНОЇ декларації межі.
 *
 * 🔴 Власне правило, а не група в тір-зоні: базове `no-restricted-imports`
 * не розрізняє `import` і `import type`, а `import type` стирається
 * компілятором і в бандл не потрапляє — забороняти його немає причини.
 * Жива сторінка `admin/pages/OrderStatuses.tsx` робить саме так із
 * `simplycms/schema/types`, і це канон Е1а, а не недогляд. Опція
 * `allowTypeImports` існує лише в typescript-eslint-версії правила, а всі
 * 26 зон репо — на базовій (виміряно).
 *
 * 🔴 Список НЕ переписується: він імпортується з декларації. Е2-11 про одну
 * копію даних, не про один механізм — той самий розріз, яким уже розділені
 * читачі 3 і 4.
 *
 * 🔴 Межа: ловить лише СТАТИЧНИЙ import/export-from. `await import(...)`
 * не бачить жоден `no-restricted-*` за побудовою — відома дірка з нульовим
 * населенням (шапка `eslint.tier-zones.mjs`). Останній рубіж — Import
 * Protection і Gate C.
 */
const SUBPATHS = new Set(SERVER_ONLY.map((sub) => `simplycms/${sub}`));
const DEP_PATTERNS = SERVER_ONLY_DEPS.map(serverOnlyDepSpecifier);

const isServerOnly = (spec) =>
  typeof spec === 'string' &&
  (SUBPATHS.has(spec) ||
    [...SUBPATHS].some((p) => spec.startsWith(`${p}/`)) ||
    DEP_PATTERNS.some((re) => re.test(spec)));

/**
 * Чи ЕМІТИТЬ цей імпорт рантайм-звʼязок.
 *
 * 🔴 Три форми, і всі три треба розрізнити: `import type {...}` не емітить
 * нічого; `import { a, type B }` емітить через `a`; side-effect
 * `import 'x'` емітить САМ ПО СОБІ, специфікаторів не маючи, — тож
 * «немає специфікаторів» означає «звіт», а не «пропустити».
 */
function emitsRuntime(node) {
  if (node.importKind === 'type' || node.exportKind === 'type') return false;
  if (!node.specifiers || node.specifiers.length === 0) return true;
  return node.specifiers.some((s) => s.importKind !== 'type');
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      serverOnly:
        'Клієнтська тека не імпортує server-only "{{spec}}": дані беруться ' +
        'serverFn. Інакше drizzle, пул Postgres або node:fs їдуть у бандл ' +
        'браузера — ловить це лише `pnpm build` хоста, не редактор. ' +
        '`import type` дозволений: він стирається компілятором.',
    },
  },
  create(context) {
    const check = (node) => {
      const spec = node.source?.value;
      if (!isServerOnly(spec) || !emitsRuntime(node)) return;
      context.report({ node, messageId: 'serverOnly', data: { spec } });
    };
    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
    };
  },
};
