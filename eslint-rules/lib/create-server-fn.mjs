/**
 * Відстеження локальних імен `createServerFn` для правил про serverFn.
 * Селектор `callee.name="createServerFn"` обходиться `import { createServerFn as mk }`,
 * namespace-імпортом і `const w = createServerFn`, тож імена виводяться з імпортів
 * (з будь-якого модуля: реекспорт у зоні теж рахується) і перепризначень — і в
 * оголошенні (`const`/`let f = createServerFn`, `= ns.createServerFn`), і простим
 * присвоєнням (`let f; f = createServerFn`): природний рефакторинг не має виводити
 * виклик з-під правил. Навмисні обходи (`wa.call`, `(0, wa)()`, динамічний `import`,
 * `s['createServerFn']`) свідомо не відстежуються — їх видно на рев'ю.
 * Голе ім'я `createServerFn` лишається в наборі — файл без імпорту (фрагмент у тесті).
 */
export function createServerFnTracker() {
  const names = new Set(['createServerFn']);
  const namespaces = new Set();
  /** Чи вираз — посилання на `createServerFn` (ім'я-аліас або `ns.createServerFn`). */
  const isRef = (n) =>
    (n?.type === 'Identifier' && names.has(n.name)) ||
    (n?.type === 'MemberExpression' &&
      !n.computed &&
      n.object.type === 'Identifier' &&
      namespaces.has(n.object.name) &&
      n.property.name === 'createServerFn');
  return {
    names,
    isRef,
    visitors: {
      ImportDeclaration(node) {
        for (const s of node.specifiers) {
          if (
            s.type === 'ImportSpecifier' &&
            s.imported.name === 'createServerFn'
          )
            names.add(s.local.name);
          if (s.type === 'ImportNamespaceSpecifier')
            namespaces.add(s.local.name);
        }
      },
      VariableDeclarator(node) {
        if (node.id.type === 'Identifier' && isRef(node.init))
          names.add(node.id.name);
      },
      AssignmentExpression(node) {
        if (
          node.operator === '=' &&
          node.left.type === 'Identifier' &&
          isRef(node.right)
        )
          names.add(node.left.name);
      },
    },
    isCreateCall(node) {
      return isRef(node.callee);
    },
  };
}
