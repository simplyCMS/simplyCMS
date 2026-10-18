/**
 * К3-4′: виклик createServerFn мусить бути ініціалізатором топ-рівневого
 * `const` з простим ідентифікатором — цього вимагає компілятор Start
 * (handleCreateServerFn.js:104-106). Гірше за помилку компілятора —
 * fast-path: для файлів, де детектовано лише serverFn, сканується ТІЛЬКИ
 * топ-рівень, тож нетоплевел-виклик МОВЧКИ лишається нетрансформованим і
 * серверний граф їде в клієнтський бандл. Це правило робить обидва режими
 * гучними на pnpm lint.
 *
 * Реекспорт `createServerFn` (`export { createServerFn } from '@tanstack/react-start'`,
 * `export * from …`, `export { createServerFn as csf }`) заборонено: компілятор Start
 * впізнає виклик за імпортом зі СВОГО пакета, тож виклик через локальний реекспорт
 * він не трансформує — і та сама мовчазна втеча серверного графа в клієнт.
 */
import { createServerFnTracker } from './lib/create-server-fn.mjs';

/** Модулі Start, що експортують `createServerFn`. */
const START_MODULE = /^@tanstack\/(?:react-start|start-[\w-]+)(?:\/|$)/;

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      notTopLevel:
        'createServerFn мусить бути топ-рівневим `const ім’я = createServerFn(...)` — ' +
        'інакше компілятор Start або впаде, або МОВЧКИ пропустить трансформацію (К3-4′).',
      reexport:
        'Реекспорт createServerFn заборонено: компілятор Start не трансформує виклик через ' +
        'локальний реекспорт — імпортуй його прямо з @tanstack/react-start (К3-4′).',
    },
  },
  create(context) {
    // Аліас `import { createServerFn as mk }` не повинен обходити правило.
    const tracker = createServerFnTracker();
    return {
      ...tracker.visitors,
      ExportAllDeclaration(node) {
        if (START_MODULE.test(node.source.value))
          context.report({ node, messageId: 'reexport' });
      },
      ExportNamedDeclaration(node) {
        const fromStart = node.source && START_MODULE.test(node.source.value);
        for (const s of node.specifiers) {
          const local = s.local.type === 'Identifier' ? s.local.name : null;
          // З джерелом — ім'я в модулі Start; без джерела — локальний аліас.
          const hit = fromStart
            ? local === 'createServerFn'
            : !node.source && local !== null && tracker.names.has(local);
          if (hit) context.report({ node: s, messageId: 'reexport' });
        }
      },
      CallExpression(node) {
        if (!tracker.isCreateCall(node)) return;
        // Легальна форма: … → VariableDeclarator(id=Identifier) →
        // VariableDeclaration → Program | ExportNamedDeclaration→Program.
        // Виклик — корінь method-chain, тож піднімаємось крізь ланцюг
        // .validator(...).handler(...) до declarator-а.
        // 🔴 Піднімаємось ЛИШЕ як `.object` MemberExpression або `.callee`
        // CallExpression, і `CallExpression`-крок дозволений ЛИШЕ одразу
        // після `MemberExpression`-кроку — дзеркалить власний предикат
        // компілятора Start (`isMethodChainCandidate`: callee чергової
        // ланки завжди сам MemberExpression). Це закриває ОБИДВА випадки:
        //   - wrap(createServerFn(...))       — виклик в arguments, не в
        //     callee (рев'ю р3);
        //   - createServerFn(...).handler(h)() — trailing re-invocation:
        //     CallExpression-крок ІДЕ ОДРАЗУ ЗА іншим CallExpression-кроком
        //     без MemberExpression між ними (рев'ю р4, Task 4 round 1).
        // В обох компілятор Start на fast-path НЕ бачить цей statement як
        // chain candidate і мовчки лишає його нетрансформованим.
        let cur = node;
        let p = node.parent;
        let cameFromMember = false; // чи попередній крок підйому — MemberExpression
        while (
          p &&
          ((p.type === 'MemberExpression' && p.object === cur) ||
            (p.type === 'CallExpression' && p.callee === cur && cameFromMember))
        ) {
          cameFromMember = p.type === 'MemberExpression';
          cur = p;
          p = p.parent;
        }
        const ok =
          p?.type === 'VariableDeclarator' &&
          p.id?.type === 'Identifier' &&
          p.parent?.type === 'VariableDeclaration' &&
          p.parent.kind === 'const' && // let/var компілятор теж не приймає
          (p.parent.parent?.type === 'Program' ||
            (p.parent.parent?.type === 'ExportNamedDeclaration' &&
              p.parent.parent.parent?.type === 'Program'));
        if (!ok) context.report({ node, messageId: 'notTopLevel' });
      },
    };
  },
};
