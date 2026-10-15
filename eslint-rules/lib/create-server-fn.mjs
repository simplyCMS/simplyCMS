/**
 * Відстеження локальних імен `createServerFn` для правил про serverFn.
 * Селектор `callee.name="createServerFn"` обходиться `import { createServerFn as mk }`,
 * namespace-імпортом і `const w = createServerFn`, тож імена виводяться з імпортів
 * (з будь-якого модуля: реекспорт у зоні теж рахується) і перепризначень.
 * Голе ім'я `createServerFn` лишається в наборі — файл без імпорту (фрагмент у тесті).
 */
export function createServerFnTracker() {
  const names = new Set(['createServerFn']);
  const namespaces = new Set();
  return {
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
        if (
          node.id.type === 'Identifier' &&
          node.init?.type === 'Identifier' &&
          names.has(node.init.name)
        )
          names.add(node.id.name);
      },
    },
    isCreateCall(node) {
      const c = node.callee;
      if (c.type === 'Identifier') return names.has(c.name);
      return (
        c.type === 'MemberExpression' &&
        !c.computed &&
        c.object.type === 'Identifier' &&
        namespaces.has(c.object.name) &&
        c.property.name === 'createServerFn'
      );
    },
  };
}
