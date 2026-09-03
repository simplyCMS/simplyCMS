import { dirname, relative, resolve, sep } from 'node:path';
import { serverOnlyOwner } from '../packages/simplycms/src/contracts/server-only.ts';

// Заборона ВІДНОСНОГО імпорту в server-only дерево ззовні нього (трек T).
//
// 🔴 Чому окреме правило, а не тір-зони: тір-зони стережуть напрямок шарів,
// а тут межа проходить УСЕРЕДИНІ шару — у теці `admin-server/` клієнтський
// стаб `index.ts` лежить сусідом із піддеревом нутрощів `impl/`. Відносний
// `./impl` заінлайнив би серверні нутрощі в клієнтський стаб: без чанка, без
// сліду в dist, без спрацювання гейта партиції. Ловити це можна лише на
// джерелі.
//
// Усередині одного server-only дерева відносні імпорти легальні
// (`storefront/loaders/session.ts` → `./db`); між ДВОМА деревами — ні
// (`auth` → `../db/client` продублював би пул у auth.js): перехід між
// деревами — лише bare-субшляхом, який бандлер лишає зовнішнім.

const PKG = resolve(import.meta.dirname, '../packages/simplycms');
const SRC = resolve(PKG, 'src');

/** Субшлях файла відносно src ядра (`db`, `admin-server/impl/x`) або null поза src. */
const subpathOf = (absolute) => {
  const rel = relative(SRC, absolute).split(sep).join('/');
  if (rel.startsWith('..')) return null;
  return rel.replace(/\.(?:[cm]?[jt]sx?)$/, '').replace(/\/index$/, '');
};

/** Рядок специфікатора: літерал або template literal без підстановок (`import(\`./impl\`)`). */
const specifierOf = (source) => {
  if (!source) return null;
  if (typeof source.value === 'string') return source.value;
  if (source.type === 'TemplateLiteral' && source.expressions.length === 0) {
    return source.quasis[0]?.value.cooked ?? null;
  }
  return null;
};

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      crossesBoundary:
        'Відносний імпорт «{{source}}» веде в server-only дерево `{{owner}}` — ' +
        'імпортуй bare-субшляхом `simplycms/{{owner}}…` (межа довіри, contracts/server-only.ts).',
    },
  },
  create(context) {
    // Межа зони — ПАКЕТ, а не `src`: `routes/**` теж їде в tarball
    // (`files` маніфеста), тож відносна втеча звідти в `src/db/client`
    // резолвиться в магазині в TS-джерело з node_modules — повз `dist`,
    // повз декларацію і повз Import Protection (відносний специфікатор,
    // file-deny у node_modules вимкнений дефолтним excludeFiles).
    if (relative(PKG, context.filename).startsWith('..')) return {};
    const importerSub = subpathOf(context.filename);
    const importerOwner =
      importerSub === null ? null : serverOnlyOwner(importerSub);
    const check = (node) => {
      const source = specifierOf(node.source);
      if (source === null || !source.startsWith('.')) return;
      const target = subpathOf(resolve(dirname(context.filename), source));
      const owner = target === null ? null : serverOnlyOwner(target);
      if (owner === null || owner === importerOwner) return;
      context.report({
        node,
        messageId: 'crossesBoundary',
        data: { source, owner },
      });
    };
    return {
      ImportDeclaration: check,
      ExportAllDeclaration: check,
      ExportNamedDeclaration: check,
      ImportExpression: check,
    };
  },
};
