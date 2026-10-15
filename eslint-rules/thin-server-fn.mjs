/**
 * І25: serverFn адмін-зони не має логіки й лише делегує операції реєстру.
 * Нова обгортка — рівно `.handler(({ data }) => invokeFromServerFn(op, data))`;
 * будь-яке інше тіло (і навіть `.handler(ідентифікатор)`) дозволене ЛИШЕ
 * іменам із legacy-переліку (`legacy-admin-server-fns.json`), який тільки
 * скорочується: ім'я, що зникло зі файла, саме є помилкою — перелік
 * не повинен переживати перенесені на реєстр serverFn.
 */

/** Корінь ланцюжка `createServerFn(...)` → ім'я топ-рівневого const (або null). */
function declaredName(call) {
  let cur = call;
  let p = call.parent;
  while (
    p &&
    ((p.type === 'MemberExpression' && p.object === cur) ||
      (p.type === 'CallExpression' && p.callee === cur))
  ) {
    cur = p;
    p = p.parent;
  }
  return p?.type === 'VariableDeclarator' && p.id.type === 'Identifier'
    ? { name: p.id.name, chainEnd: cur }
    : null;
}

/** `({ data }) => invokeFromServerFn(<ідентифікатор>, data)` — і більше нічого. */
function isThinHandler(arg) {
  if (arg?.type !== 'ArrowFunctionExpression' || arg.async) return false;
  const [param, ...more] = arg.params;
  const okParam =
    more.length === 0 &&
    param?.type === 'ObjectPattern' &&
    param.properties.length === 1 &&
    param.properties[0].type === 'Property' &&
    !param.properties[0].computed &&
    param.properties[0].key.name === 'data' &&
    param.properties[0].value.type === 'Identifier' &&
    param.properties[0].value.name === 'data';
  const body = arg.body;
  return (
    okParam &&
    body.type === 'CallExpression' &&
    body.callee.type === 'Identifier' &&
    body.callee.name === 'invokeFromServerFn' &&
    body.arguments.length === 2 &&
    body.arguments[0].type === 'Identifier' &&
    body.arguments[1].type === 'Identifier' &&
    body.arguments[1].name === 'data'
  );
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
      notThin:
        'serverFn «{{name}}» не тонка: очікується `.handler(({ data }) => invokeFromServerFn(операція, data))` (І25). Логіка живе в операції реєстру.',
      staleLegacy:
        'Ім’я «{{name}}» у legacy-переліку більше не є serverFn цього файла — прибери його з eslint-rules/legacy-admin-server-fns.json (перелік лише скорочується).',
    },
  },
  create(context) {
    const legacy = new Set(context.options[0]?.legacy ?? []);
    const seen = new Set();
    return {
      'CallExpression[callee.name="createServerFn"]'(node) {
        const decl = declaredName(node);
        if (!decl) return;
        seen.add(decl.name);
        if (legacy.has(decl.name)) return;
        const end = decl.chainEnd;
        const isHandler =
          end.type === 'CallExpression' &&
          end.callee.type === 'MemberExpression' &&
          end.callee.property.name === 'handler' &&
          end.arguments.length === 1;
        if (!isHandler || !isThinHandler(end.arguments[0]))
          context.report({
            node,
            messageId: 'notThin',
            data: { name: decl.name },
          });
      },
      'Program:exit'(node) {
        for (const name of legacy)
          if (!seen.has(name))
            context.report({ node, messageId: 'staleLegacy', data: { name } });
      },
    };
  },
};
