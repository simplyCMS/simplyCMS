/**
 * К3-4′: виклик createServerFn мусить бути ініціалізатором топ-рівневого
 * `const` з простим ідентифікатором — цього вимагає компілятор Start
 * (handleCreateServerFn.js:104-106). Гірше за помилку компілятора —
 * fast-path: для файлів, де детектовано лише serverFn, сканується ТІЛЬКИ
 * топ-рівень, тож нетоплевел-виклик МОВЧКИ лишається нетрансформованим і
 * серверний граф їде в клієнтський бандл. Це правило робить обидва режими
 * гучними на pnpm lint.
 */
export default {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      notTopLevel:
        'createServerFn мусить бути топ-рівневим `const ім’я = createServerFn(...)` — ' +
        'інакше компілятор Start або впаде, або МОВЧКИ пропустить трансформацію (К3-4′).',
    },
  },
  create(context) {
    return {
      'CallExpression[callee.name="createServerFn"]'(node) {
        // Легальна форма: … → VariableDeclarator(id=Identifier) →
        // VariableDeclaration → Program | ExportNamedDeclaration→Program.
        // Виклик — корінь method-chain, тож піднімаємось крізь ланцюг
        // .inputValidator(...).handler(...) до declarator-а.
        // 🔴 Піднімаємось ЛИШЕ як `.object` MemberExpression або `.callee`
        // CallExpression (рев'ю р3): `wrap(createServerFn(...))` кладе
        // ланцюг в arguments — компілятор Start це відхиляє
        // (handleCreateServerFn: parentPath мусить бути declarator), а
        // безумовний прохід крізь CallExpression пропускав би wrapper.
        let cur = node;
        let p = node.parent;
        while (
          p &&
          ((p.type === 'MemberExpression' && p.object === cur) ||
            (p.type === 'CallExpression' && p.callee === cur))
        ) { cur = p; p = p.parent; }
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
