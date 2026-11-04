/**
 * Write-back колекції (`*.utils.write*(…)`, `*.utils.writeBatch(…)`) — лише
 * під `await`, `return` або `void` з причиною.
 *
 * Чому: з TanStack DB 1.0 / query-db-collection 1.5 ці виклики повертають
 * Promise, що резолвиться, коли кеш ПРИЙНЯВ рядок сервера. Загублений Promise
 * означає дві речі. Помилка запису стає unhandled rejection, а не помилкою
 * дії. А код після виклику (тост «збережено», інвалідація споживачів)
 * виконується раніше, ніж кеш тримає правду сервера. Клас повторився
 * (8 місць після бампу), а typed-linting (`no-floating-promises`) у репо не
 * ввімкнено, тож сторожить синтаксичне правило.
 *
 * Що вважається обробленим:
 * - `await x.utils.writeUpsert(row)`;
 * - `return x.utils.writeBatch(…)` або concise-стрілка `() => x.utils.writeDelete(id)`;
 * - `void x.utils.write…(…)` ЛИШЕ з коментарем `// write-back-void: <причина>`
 *   рядком вище statement-а.
 * Виклики `write*` ВСЕРЕДИНІ callback-а `writeBatch` — поза правилом: callback
 * синхронний за контрактом бібліотеки, Promise батчу повертає сам `writeBatch`.
 *
 * 🔴 Власне імʼя плагіна (`simplycms-write-back`): flat config замінює опції
 * правила цілком, а зона перетинається з `mutation-cache-sync`.
 */
const WRITE_OPS = new Set([
  'writeUpsert',
  'writeUpdate',
  'writeInsert',
  'writeDelete',
  'writeBatch',
]);
const FN_TYPES = new Set([
  'ArrowFunctionExpression',
  'FunctionExpression',
  'FunctionDeclaration',
]);

const propName = (member) =>
  member.computed ? member.property.value : member.property.name;

/** `<x>.utils.<op>` — повертає імʼя операції або null. */
const writeOp = (call) => {
  const callee = call.callee;
  if (callee?.type !== 'MemberExpression') return null;
  const op = propName(callee);
  if (!WRITE_OPS.has(op)) return null;
  const obj = callee.object;
  return obj?.type === 'MemberExpression' && propName(obj) === 'utils'
    ? op
    : null;
};

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      floating:
        'Write-back колекції повертає Promise — постав `await` (або `return`); ' +
        'свідомий `void` — лише з `// write-back-void: <причина>` рядком вище ' +
        '(див. eslint-rules/awaited-write-back.mjs).',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    /** Чи стоїть виклик усередині callback-а `*.utils.writeBatch(cb)`. */
    const insideBatchCallback = (node) => {
      for (let p = node.parent; p; p = p.parent) {
        if (!FN_TYPES.has(p.type)) continue;
        const call = p.parent;
        if (
          call?.type === 'CallExpression' &&
          call.arguments[0] === p &&
          writeOp(call) === 'writeBatch'
        )
          return true;
      }
      return false;
    };

    const hasVoidReason = (node) => {
      let s = node;
      while (s.parent && !/Statement$|Declaration$/.test(s.type)) s = s.parent;
      const comments = sourceCode.getCommentsBefore(s);
      const last = comments[comments.length - 1];
      return (
        !!last &&
        /^\s*write-back-void:\s*\S/.test(last.value) &&
        last.loc.end.line === s.loc.start.line - 1
      );
    };

    return {
      CallExpression(node) {
        if (!writeOp(node) || insideBatchCallback(node)) return;
        // TS-обгортки (`x as never`, `x!`) не міняють, чи оброблено Promise.
        let child = node;
        let parent = node.parent;
        while (
          parent &&
          (parent.type === 'TSAsExpression' ||
            parent.type === 'TSNonNullExpression' ||
            parent.type === 'ChainExpression')
        ) {
          child = parent;
          parent = parent.parent;
        }
        if (parent?.type === 'AwaitExpression') return;
        if (parent?.type === 'ReturnStatement') return;
        if (parent?.type === 'ArrowFunctionExpression' && parent.body === child)
          return;
        if (
          parent?.type === 'UnaryExpression' &&
          parent.operator === 'void' &&
          hasVoidReason(parent)
        )
          return;
        context.report({ node, messageId: 'floating' });
      },
    };
  },
};
