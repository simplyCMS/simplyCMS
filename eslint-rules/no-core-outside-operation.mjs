/**
 * І25: `withActor`, `runAdmin`, `runAdminTransactions` і `*In` з
 * `simplycms/admin-server/impl` викликаються лише всередині `run` операції
 * (файли `operations.ts` і теки `operations/`). Правило вішається на зони,
 * де цього робити не можна: роути, `src/admin`, вітринні серверні модулі й
 * файли serverFn. У файлах serverFn legacy-імена (опція `legacy`) звільнені:
 * їхні тіла ще йдуть через `runAdmin` до М3.
 *
 * Обхід по імені не проходить: стежимо за прив'язками імпорту (аліас,
 * namespace + `ns.fn()`), деструктуризацією namespace, перепризначенням
 * (`const w = withActor`) і викликом як методу (`x.withActor()`).
 */
const FORBIDDEN = new Set(['withActor', 'runAdmin', 'runAdminTransactions']);
const SOURCES = new Set(['simplycms/db', 'simplycms/admin-server/impl']);
const IMPL = 'simplycms/admin-server/impl';

/** Ім'я топ-рівневої декларації, що містить вузол. */
function topLevelName(node) {
  let cur = node;
  while (cur.parent && cur.parent.type !== 'Program') cur = cur.parent;
  const d = cur.type === 'ExportNamedDeclaration' ? cur.declaration : cur;
  return d?.type === 'VariableDeclaration' &&
    d.declarations[0]?.id.type === 'Identifier'
    ? d.declarations[0].id.name
    : null;
}

/** Ім'я властивості без обчислення (`a.b`, `a['b']`), інакше null. */
function propName(m) {
  if (!m.computed) return m.property.name;
  return m.property.type === 'Literal' ? String(m.property.value) : null;
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    schema: [
      {
        type: 'object',
        properties: { legacy: { type: 'array', items: { type: 'string' } } },
        additionalProperties: false,
      },
    ],
    messages: {
      outside:
        'Виклик `{{name}}` поза операцією (І25): доступ до даних — лише в `run` операції реєстру.',
    },
  },
  create(context) {
    const legacy = new Set(context.options[0]?.legacy ?? []);
    const bad = new Set(FORBIDDEN); // локальні імена, виклик яких заборонений
    const spaces = new Map(); // namespace-імпорт → джерело
    const forbiddenIn = (name, src) =>
      FORBIDDEN.has(name) || (src === IMPL && /In$/.test(name));
    /** Чи значення виразу — заборонена функція (для перепризначення). */
    const isBadExpr = (e) =>
      (e?.type === 'Identifier' && bad.has(e.name)) ||
      (e?.type === 'MemberExpression' &&
        e.object.type === 'Identifier' &&
        spaces.has(e.object.name) &&
        forbiddenIn(propName(e) ?? '', spaces.get(e.object.name)));
    const report = (node, name) => {
      const owner = topLevelName(node);
      if (owner && legacy.has(owner)) return;
      context.report({ node, messageId: 'outside', data: { name } });
    };
    return {
      ImportDeclaration(node) {
        const src = node.source.value;
        if (!SOURCES.has(src)) return;
        for (const s of node.specifiers) {
          if (s.type === 'ImportNamespaceSpecifier')
            spaces.set(s.local.name, src);
          else if (
            s.type === 'ImportSpecifier' &&
            forbiddenIn(s.imported.name, src)
          )
            bad.add(s.local.name);
        }
      },
      VariableDeclarator(node) {
        if (node.id.type === 'Identifier' && isBadExpr(node.init))
          bad.add(node.id.name);
        // const { withActor: w } = ns
        if (
          node.id.type === 'ObjectPattern' &&
          node.init?.type === 'Identifier' &&
          spaces.has(node.init.name)
        )
          for (const p of node.id.properties)
            if (
              p.type === 'Property' &&
              p.key.type === 'Identifier' &&
              p.value.type === 'Identifier' &&
              forbiddenIn(p.key.name, spaces.get(node.init.name))
            )
              bad.add(p.value.name);
      },
      CallExpression(node) {
        const c = node.callee;
        if (c.type === 'Identifier' && bad.has(c.name)) report(node, c.name);
        else if (c.type === 'MemberExpression') {
          const name = propName(c);
          // `db.withActor(...)` — метод будь-якого обʼєкта; `ns.fnIn(...)` — з namespace.
          if (name && FORBIDDEN.has(name)) report(node, name);
          else if (isBadExpr(c)) report(node, name ?? '?');
        }
      },
    };
  },
};
