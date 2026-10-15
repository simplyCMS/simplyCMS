/**
 * І25: serverFn адмін-зони не має логіки й лише делегує операції реєстру.
 * Нова (не-legacy) обгортка має РІВНО форму
 *   createServerFn({ method }).validator(passThrough)
 *     .handler(({ data }) => invokeFromServerFn(<операція>, data))
 * і нічого іншого: ні `.middleware`, ні іншого валідатора, ні тіла — логіку
 * можна сховати не лише в `.handler`, а й у валідатор чи middleware, що теж
 * виконуються на сервері. `invokeFromServerFn` і `passThrough` мусять бути
 * імпортовані з `simplycms/operations/server`, а не оголошені локально.
 * Legacy-імена (`legacy-admin-server-fns.json`) звільнені; ім'я, що зникло
 * з файла, саме є помилкою — перелік лише скорочується (храповик — тест).
 */
import { createServerFnTracker } from './lib/create-server-fn.mjs';

const OPS_SOURCE = 'simplycms/operations/server';

/** Ланцюжок `root(...).a(...).b(...)` → { name, chain: [{ method, args }] }. */
function readChain(root) {
  const chain = [];
  let cur = root;
  let p = root.parent;
  while (
    p?.type === 'MemberExpression' &&
    p.object === cur &&
    p.parent?.type === 'CallExpression' &&
    p.parent.callee === p
  ) {
    chain.push({ method: p.property.name, args: p.parent.arguments });
    cur = p.parent;
    p = cur.parent;
  }
  const name =
    p?.type === 'VariableDeclarator' && p.id.type === 'Identifier'
      ? p.id.name
      : null;
  return { name, chain };
}

const isIdent = (n, name) => n?.type === 'Identifier' && n.name === name;

/** `({ data }) => <invoke>(<ідентифікатор>, data)` — і більше нічого. */
function isThinHandler(arg, invoke) {
  if (arg?.type !== 'ArrowFunctionExpression' || arg.async) return false;
  const [param, ...more] = arg.params;
  const prop = param?.type === 'ObjectPattern' ? param.properties[0] : null;
  const body = arg.body;
  return (
    more.length === 0 &&
    param.properties.length === 1 &&
    prop.type === 'Property' &&
    !prop.computed &&
    isIdent(prop.key, 'data') &&
    isIdent(prop.value, 'data') &&
    body.type === 'CallExpression' &&
    invoke !== undefined &&
    isIdent(body.callee, invoke) &&
    body.arguments.length === 2 &&
    body.arguments[0].type === 'Identifier' &&
    isIdent(body.arguments[1], 'data')
  );
}

/** `createServerFn()` / `createServerFn({ method })` — без інших ключів. */
function isPlainRoot(call) {
  const [opts, ...more] = call.arguments;
  return (
    more.length === 0 &&
    (!opts ||
      (opts.type === 'ObjectExpression' &&
        opts.properties.every(
          (x) => x.type === 'Property' && isIdent(x.key, 'method'),
        )))
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
        'serverFn «{{name}}» не тонка: очікується `createServerFn({ method }).validator(passThrough).handler(({ data }) => invokeFromServerFn(операція, data))` без middleware й іншого коду, `invokeFromServerFn`/`passThrough` — з simplycms/operations/server (І25). Логіка живе в операції реєстру.',
      staleLegacy:
        'Ім’я «{{name}}» у legacy-переліку більше не є serverFn цього файла — прибери його з eslint-rules/legacy-admin-server-fns.json (перелік лише скорочується).',
    },
  },
  create(context) {
    const legacy = new Set(context.options[0]?.legacy ?? []);
    const tracker = createServerFnTracker();
    const seen = new Set();
    const imported = new Map(); // імпортоване з OPS_SOURCE: оригінал → локальне
    return {
      ...tracker.visitors,
      ImportDeclaration(node) {
        tracker.visitors.ImportDeclaration(node);
        if (node.source.value !== OPS_SOURCE) return;
        for (const s of node.specifiers)
          if (s.type === 'ImportSpecifier')
            imported.set(s.imported.name, s.local.name);
      },
      CallExpression(node) {
        if (!tracker.isCreateCall(node)) return;
        const { name, chain } = readChain(node);
        if (name) seen.add(name);
        if (name && legacy.has(name)) return;
        const [v, h, ...rest] = chain;
        const ok =
          rest.length === 0 &&
          isPlainRoot(node) &&
          v?.method === 'validator' &&
          v.args.length === 1 &&
          isIdent(v.args[0], imported.get('passThrough') ?? '\0') &&
          h?.method === 'handler' &&
          h.args.length === 1 &&
          isThinHandler(h.args[0], imported.get('invokeFromServerFn'));
        if (!ok)
          context.report({
            node,
            messageId: 'notThin',
            data: { name: name ?? '(без імені)' },
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
