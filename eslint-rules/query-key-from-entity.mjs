/**
 * `queryKey` будується з реєстру ENTITY, а не пишеться літералом.
 *
 * 🔴 Окреме правило, а не селектор у `no-restricted-syntax`: flat config
 * замінює опції правила цілком, тож зона поверх i18n-зони мовчки
 * вимкнула б одну з двох (`eslint.config.mjs:241-243`).
 *
 * Ловить три форми, яких евристичний селектор не бачив:
 *   queryKey: ['banners']                 — прямий літерал
 *   queryKey: ADDRESS_BOOK_KEY            — константа-масив у модулі
 *   queryKey: cond ? ['a'] : ['b', id]    — умовний вибір
 * Значення має лише ПЕРШИЙ сегмент — він визначає префікс.
 */
const MESSAGE =
  'queryKey мусить починатися з ENTITY/AGGREGATE/SESSION_KEY ' +
  '(simplycms/contracts/entities). Літеральний перший сегмент дає ' +
  'сутності різні префікси, і оновлення кешу проминає записи.';

/** `x as const` / `(x)` / `x satisfies T` — розгорнути до самого виразу. */
function unwrap(node) {
  let n = node;
  while (
    n &&
    (n.type === 'TSAsExpression' ||
      n.type === 'TSTypeAssertion' ||
      n.type === 'TSSatisfiesExpression')
  ) {
    n = n.expression;
  }
  return n;
}

/** Гілки умовного виразу — інакше `cond ? ['a'] : ['b']` пройде повз. */
function branches(node) {
  if (node?.type === 'ConditionalExpression') {
    return [...branches(node.consequent), ...branches(node.alternate)];
  }
  return [node];
}

/** Масив, чий ПЕРШИЙ елемент — рядковий літерал. */
const startsWithLiteral = (node) =>
  node?.type === 'ArrayExpression' &&
  node.elements[0]?.type === 'Literal' &&
  typeof node.elements[0].value === 'string';

export default {
  meta: {
    type: 'problem',
    docs: { description: 'queryKey з реєстру ENTITY' },
    schema: [],
    messages: { literalKey: MESSAGE },
  },
  create(context) {
    // Константи-масиви модуля: `const ADDRESS_BOOK_KEY = ['address-book']`.
    const literalConsts = new Set();

    return {
      VariableDeclarator(node) {
        if (
          node.id.type === 'Identifier' &&
          startsWithLiteral(unwrap(node.init))
        ) {
          literalConsts.add(node.id.name);
        }
      },
      Property(node) {
        const key = node.key;
        const name =
          key.type === 'Identifier'
            ? key.name
            : key.type === 'Literal'
              ? key.value
              : null;
        if (name !== 'queryKey') return;

        for (const candidate of branches(node.value)) {
          const value = unwrap(candidate);
          const offends =
            startsWithLiteral(value) ||
            (value?.type === 'Identifier' && literalConsts.has(value.name));
          if (offends) {
            context.report({ node: candidate, messageId: 'literalKey' });
            return;
          }
        }
      },
    };
  },
};
