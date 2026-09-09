/**
 * Клієнтська мутація мусить лишати слід у кеші (урок №6 роадмапу:
 * колекція НЕ рефетчиться від invalidateQueries React Query).
 *
 * 🔴 Межа аналізу — ФУНКЦІЯ, не файл (рев'ю р3: файлова евристика
 * сліпа на змішаних сторінках — інший хендлер із синком «покривав» би
 * хендлер без нього, і негативний контроль на реальній сторінці був
 * фізично неможливий). Тригер — виклик serverFn, імпортованого з
 * 'simplycms/admin-server' (будь-яке імʼя, крім list*-читань), АБО
 * useMutation. Для кожного тригера береться найближча охоплююча функція
 * (стрілка/function/метод), і В НІЙ мусить бути синк:
 *   collection.utils.{refetch,writeUpsert,writeUpdate,writeDelete,writeBatch}
 *   АБО collection.insert/update/delete (оптимістичний шлях сам синкає)
 *   АБО invalidateQueries/setQueryData/refetchQueries (легасі React Query;
 *   але якщо файл імпортує simplycms/admin-data — цього НЕ досить,
 *   інвалідація колекцію не будить → invalidateOnly).
 * Виклики всередині persistence-хендлерів (onInsert/onUpdate/onDelete) —
 * поза правилом: їх стереже handler-canon. Виклик у loader (preload) —
 * теж поза правилом (читання). Opt-out — `// cache-sync-ok: <причина>`
 * рядком вище виклику.
 */
const SYNC_UTILS = new Set([
  'refetch',
  'writeUpsert',
  'writeUpdate',
  'writeDelete',
  'writeBatch',
]);
const OPTIMISTIC = new Set(['insert', 'update', 'delete']);
const QUERY_SYNC = new Set([
  'invalidateQueries',
  'setQueryData',
  'refetchQueries',
]);
const HANDLERS = new Set(['onInsert', 'onUpdate', 'onDelete']);
const FN_TYPES = new Set([
  'ArrowFunctionExpression',
  'FunctionExpression',
  'FunctionDeclaration',
]);

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      noSync:
        'Мутація без сліду в кеші у ЦІЙ функції: додай collection-синк або поясни // cache-sync-ok (див. eslint-rules/mutation-cache-sync.mjs).',
      invalidateOnly:
        'invalidateQueries не будить TanStack DB-колекцію — потрібен collection.utils.* синк у цій функції.',
      unresolvedConfig:
        'useMutation з конфігом, який правило не може резолвити (не інлайн-обʼєкт і не const у цій області) — винеси в const або поясни // cache-sync-ok.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const serverFns = new Set();
    let usesAdminData = false;

    const enclosingFn = (node) => {
      let p = node.parent;
      while (p && !FN_TYPES.has(p.type)) p = p.parent;
      return p;
    };
    // 🔴 Persistence-виняток — по ВСІХ предках (рев'ю р4): serverFn у
    // вкладеному callback усередині onInsert має найближчою функцією той
    // callback, а не хендлер.
    const COLLECTION_OPTION_FACTORIES = new Set([
      'queryCollectionOptions',
      'createCollection',
    ]);
    const insidePersistenceHandler = (node) => {
      for (let p = node.parent; p; p = p.parent) {
        if (p.type === 'Property' && HANDLERS.has(p.key?.name)) {
          // Виняток — ЛИШЕ для onInsert/onUpdate/onDelete в config-обʼєкті
          // фабрики колекції (р5: довільний `{ onInsert: … }` вимикав правило).
          const obj = p.parent,
            call = obj?.parent;
          return (
            obj?.type === 'ObjectExpression' &&
            call?.type === 'CallExpression' &&
            COLLECTION_OPTION_FACTORIES.has(call.callee?.name)
          );
        }
      }
      return false;
    };
    // 🔴 Opt-out шукається перед STATEMENT-ом, не перед call (рев'ю р4):
    // між `// cache-sync-ok:` і `reorderOrderStatus(...)` стоїть токен
    // `await`, і getCommentsBefore(call) порожній. Причина обовʼязкова.
    const hasExempt = (node) => {
      // Піднімаємось, доки САМ вузол не стане Statement/Declaration (р5:
      // перевірка parent-а віддавала getCommentsBefore дитину — `return
      // serverFn()` і `const x = await serverFn()` opt-out не бачили).
      // …і доки цей statement не стоїть безпосередньо в Block/Program: для
      // `if (x) await serverFn()` без дужок директива стоїть над `if`, а не
      // над вкладеним ExpressionStatement.
      const isStmt = (n) => /Statement$|Declaration$/.test(n.type);
      const atBlockLevel = (n) =>
        n.parent?.type === 'BlockStatement' || n.parent?.type === 'Program';
      let s = node;
      while (s.parent && !(isStmt(s) && atBlockLevel(s))) s = s.parent;
      const comments = sourceCode.getCommentsBefore(s);
      const last = comments[comments.length - 1];
      // Директива — заякорена, з причиною, і РІВНО рядком вище (порожній
      // рядок чи чужий префікс «no-cache-sync-ok» — не opt-out).
      return (
        !!last &&
        /^\s*cache-sync-ok:\s*\S/.test(last.value) &&
        last.loc.end.line === s.loc.start.line - 1
      );
    };

    const COLLECTION_FACTORIES = new Set(['useCollection', 'getCollection']);
    const unwrap = (n) => {
      while (
        n &&
        (n.type === 'TSAsExpression' ||
          n.type === 'TSSatisfiesExpression' ||
          n.type === 'TSNonNullExpression')
      )
        n = n.expression;
      return n;
    };
    /** Config useMutation: інлайн-обʼєкт або `const opts = {…}` через scope (р5). */
    const resolveConfig = (arg, at) => {
      let n = unwrap(arg);
      if (n?.type === 'Identifier') {
        for (let s = sourceCode.getScope(at); s; s = s.upper) {
          const v = s.set.get(n.name);
          if (v) {
            n = unwrap(v.defs[0]?.node?.init);
            break;
          }
        }
      }
      return n?.type === 'ObjectExpression' ? n : null;
    };
    /** Обʼєкт «схожий на mutation-config»: має mutationFn (для guard-а serverFn). */
    const isMutationConfig = (obj) =>
      obj?.type === 'ObjectExpression' &&
      obj.properties.some(
        (p) => p.type === 'Property' && p.key?.name === 'mutationFn',
      );
    const isCollectionVar = (ident, at) => {
      for (let s = sourceCode.getScope(at); s; s = s.upper) {
        const v = s.set.get(ident.name);
        if (!v) continue;
        const init = v.defs[0]?.node?.init;
        return (
          init?.type === 'CallExpression' &&
          COLLECTION_FACTORIES.has(init.callee?.name)
        );
      }
      return false;
    };

    // 🔴 Сканування НЕ заходить у вкладені функції (рев'ю р4): інакше
    // useMutation на рівні компонента «бачив» би синк сусіднього
    // хендлера, а це і є клас фолс-негативів файлової евристики.
    const scanFn = (root) => {
      let collectionSync = false,
        querySync = false;
      const walk = (n) => {
        if (!n || typeof n.type !== 'string') return;
        // Для config-обʼєкта useMutation — його прямі callbacks сканувати
        // ТРЕБА (вони і є тіло мутації), глибші вкладені — ні.
        if (
          n !== root &&
          FN_TYPES.has(n.type) &&
          !(
            root.type === 'ObjectExpression' &&
            n.parent?.type === 'Property' &&
            n.parent.parent === root
          )
        )
          return;
        if (
          n.type === 'CallExpression' &&
          n.callee.type === 'MemberExpression'
        ) {
          const name = n.callee.property?.name;
          const obj = n.callee.object;
          if (
            SYNC_UTILS.has(name) &&
            obj.type === 'MemberExpression' &&
            obj.property?.name === 'utils'
          )
            collectionSync = true;
          // Отримувач insert/update/delete — змінна, ініціалізована
          // useCollection(...)/getCollection(...): за ПОХОДЖЕННЯМ, не за
          // іменем (самоперевірка р5: `const statuses = useCollection(…)`
          // інакше не рахувався б, і сторінка діставала хибний noSync).
          if (
            OPTIMISTIC.has(name) &&
            obj.type === 'Identifier' &&
            isCollectionVar(obj, n)
          )
            collectionSync = true;
          if (QUERY_SYNC.has(name)) querySync = true;
        }
        for (const key of sourceCode.visitorKeys[n.type] ?? []) {
          const child = n[key];
          if (Array.isArray(child)) child.forEach(walk);
          else if (child) walk(child);
        }
      };
      walk(root.type === 'ObjectExpression' ? root : root.body);
      return { collectionSync, querySync };
    };

    /**
     * Що сканувати: для useMutation — його config-обʼєкт (mutationFn/
     * onSuccess/onSettled — усі callbacks там, і ТІЛЬКИ там); для виклику
     * serverFn — тіло найближчої охоплюючої функції без вкладених.
     */
    const check = (trigger, scope) => {
      if (hasExempt(trigger) || insidePersistenceHandler(trigger)) return;
      if (!scope) return;
      const { collectionSync, querySync } = scanFn(scope);
      if (!collectionSync && !querySync)
        context.report({ node: trigger, messageId: 'noSync' });
      else if (!collectionSync && querySync && usesAdminData)
        context.report({ node: trigger, messageId: 'invalidateOnly' });
    };

    return {
      ImportDeclaration(node) {
        if (node.source.value === 'simplycms/admin-data') usesAdminData = true;
        if (node.source.value === 'simplycms/admin-server')
          for (const s of node.specifiers)
            if (s.type === 'ImportSpecifier' && !/^list/.test(s.imported.name))
              serverFns.add(s.local.name);
      },
      'CallExpression[callee.name="useMutation"]'(node) {
        if (hasExempt(node)) return;
        const cfg = resolveConfig(node.arguments[0], node);
        if (!cfg) {
          context.report({ node, messageId: 'unresolvedConfig' });
          return;
        }
        check(node, cfg);
      },
      'CallExpression[callee.type="Identifier"]'(node) {
        if (!serverFns.has(node.callee.name)) return;
        const fn = enclosingFn(node);
        // serverFn усередині callback-а useMutation-config (mutationFn/
        // onSuccess…) стереже тригер useMutation — інакше синк у сусідньому
        // onSuccess дав би хибний noSync на mutationFn (самоперевірка р4).
        // Розпізнаємо config за ФОРМОЮ (має mutationFn), не за позицією —
        // працює і для винесеного `const opts = { mutationFn, onSuccess }` (р5).
        const cfg = fn?.parent?.type === 'Property' ? fn.parent.parent : null;
        if (isMutationConfig(cfg)) return;
        check(node, fn);
      },
    };
  },
};
