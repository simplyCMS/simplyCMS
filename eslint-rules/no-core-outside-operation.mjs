/**
 * І25: `withActor(`, `runAdmin(`, `runAdminTransactions(` і `*In` з
 * `simplycms/admin-server/impl` викликаються лише всередині `run` операції
 * (файли `operations.ts` і теки `operations/`). Правило вішається на зони,
 * де цього робити не можна: роути, `src/admin`, вітринні серверні модулі й
 * файли serverFn. У файлах serverFn legacy-імена (опція `legacy`) звільнені:
 * їхні тіла ще йдуть через `runAdmin` до М3.
 */
const FORBIDDEN = new Set(['withActor', 'runAdmin', 'runAdminTransactions']);
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
    const implIn = new Set(); // локальні імена `*In`, імпортовані з impl
    return {
      ImportDeclaration(node) {
        if (node.source.value !== IMPL) return;
        for (const s of node.specifiers)
          if (s.type === 'ImportSpecifier' && /In$/.test(s.imported.name))
            implIn.add(s.local.name);
      },
      CallExpression(node) {
        if (node.callee.type !== 'Identifier') return;
        const name = node.callee.name;
        if (!FORBIDDEN.has(name) && !implIn.has(name)) return;
        const owner = topLevelName(node);
        if (owner && legacy.has(owner)) return;
        context.report({ node, messageId: 'outside', data: { name } });
      },
    };
  },
};
