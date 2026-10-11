/**
 * Ратчет проти повернення `@supabase/*` (К3-Е7, Р2): шар Supabase знесено,
 * БД — лише через `simplycms/db`.
 *
 * 🔴 Власне правило з власним імʼям плагіна (`simplycms-supabase`), а не
 * `no-restricted-imports`: flat config замінює опції правила цілком, тож
 * ще один блок із ним затер би сусідні зони (див. `no-direct-storage`).
 *
 * Ловить статичні import/export-from, динамічний `import()` (рядок або
 * шаблон без виразів) і `require('…')` зі строковим літералом.
 */
const isSupabase = (spec) =>
  typeof spec === 'string' &&
  (spec === '@supabase' || spec.startsWith('@supabase/'));

/** Значення специфікатора, якщо воно статичне; інакше null. */
const staticValue = (node) => {
  if (!node) return null;
  if (node.type === 'Literal') return node.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0].value.cooked;
  }
  return null;
};

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      supabaseImport:
        'Supabase знесено в К3-Е7: `@supabase/*` не імпортується. ' +
        'Доступ до БД — лише через simplycms/db (withActor).',
    },
  },
  create(context) {
    const check = (node, source) => {
      if (isSupabase(staticValue(source))) {
        context.report({ node, messageId: 'supabaseImport' });
      }
    };
    return {
      ImportDeclaration: (node) => check(node, node.source),
      ExportAllDeclaration: (node) => check(node, node.source),
      ExportNamedDeclaration: (node) => check(node, node.source),
      ImportExpression: (node) => check(node, node.source),
      "CallExpression[callee.name='require'][arguments.0.type='Literal']": (
        node,
      ) => check(node, node.arguments[0]),
    };
  },
};
