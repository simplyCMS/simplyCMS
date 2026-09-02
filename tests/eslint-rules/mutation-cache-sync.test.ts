import { describe, expect, it } from 'vitest';
import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import rule from '../../eslint-rules/mutation-cache-sync.mjs';

const linter = new Linter({ configType: 'flat' });
const config: Linter.Config[] = [
  {
    files: ['**/*.tsx', '**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { s: { rules: { 'mutation-cache-sync': rule } } },
    rules: { 's/mutation-cache-sync': 'error' },
  },
];
const HEAD = `import { useMutation } from '@tanstack/react-query';
import { useCollection, orderStatusesCollection } from 'simplycms/admin-data';
import { listOrderStatuses, insertOrderStatuses, setDefaultOrderStatus, reorderOrderStatus } from 'simplycms/admin-server';
`;
const lint = (code: string, head = HEAD) =>
  linter.verify(head + code, config, { filename: 'f.tsx' });
const ids = (code: string, head?: string) =>
  lint(code, head).map((m) => m.messageId);

describe('mutation-cache-sync (function-scope)', () => {
  it('сторінка Task 10 — чиста', () => {
    expect(
      ids(`export function Page() {
      const collection = useCollection(orderStatusesCollection);
      const handleCreate = (form) => { const tx = collection.insert({ id: 'x', ...form }); tx.isPersisted.promise.then(() => {}); };
      const handleUpdate = (id, form) => { collection.update(id, (d) => { d.name = form.name; }); };
      const handleDelete = (id) => { collection.delete(id); };
      const applyDefault = async (id) => { await setDefaultOrderStatus({ data: { id } }); await collection.utils.refetch(); };
      const handleReorder = async (id, dir) => { await reorderOrderStatus({ data: { id, dir } }); await collection.utils.refetch(); };
      return <button onClick={() => handleReorder('a', 'up')} />;
    }`),
    ).toEqual([]);
  });

  it('прибраний refetch у handleReorder — noSync САМЕ там (сусідній синк не покриває)', () => {
    expect(
      ids(`export function Page() {
      const collection = useCollection(orderStatusesCollection);
      const applyDefault = async (id) => { await setDefaultOrderStatus({ data: { id } }); await collection.utils.refetch(); };
      const handleReorder = async (id) => { await reorderOrderStatus({ data: { id } }); };
      return null;
    }`),
    ).toEqual(['noSync']);
  });

  it('useMutation без синку поруч із хендлером із синком — офендер', () => {
    expect(
      ids(`export function Page() {
      const collection = useCollection(orderStatusesCollection);
      const m = useMutation({ mutationFn: async (x) => fetch('/api', { body: x }) });
      const handleReorder = async (id) => { await reorderOrderStatus({ data: { id } }); await collection.utils.refetch(); };
      return null;
    }`),
    ).toEqual(['noSync']);
  });

  it('useMutation(serverFn у mutationFn) + refetch в onSuccess — чисто', () => {
    expect(
      ids(`export function Page() {
      const collection = useCollection(orderStatusesCollection);
      const m = useMutation({ mutationFn: (id) => setDefaultOrderStatus({ data: { id } }), onSuccess: () => collection.utils.refetch() });
      return null;
    }`),
    ).toEqual([]);
  });

  it('opt-out — лише з причиною, рівно рядком вище, у будь-якій формі statement', () => {
    const body = (comment: string, stmt: string) => `export function Page() {
      const handleReorder = async (id) => {
        ${comment}
        ${stmt}
      };
      return null;
    }`;
    const OK = '// cache-sync-ok: refetch робить викликач';
    for (const stmt of [
      'await reorderOrderStatus({ data: { id } });',
      'return reorderOrderStatus({ data: { id } });',
      'const r = await reorderOrderStatus({ data: { id } });',
      'if (id) await reorderOrderStatus({ data: { id } });',
    ])
      expect(ids(body(OK, stmt)), stmt).toEqual([]);
    expect(
      ids(
        body(
          '// cache-sync-ok:',
          'await reorderOrderStatus({ data: { id } });',
        ),
      ),
    ).toEqual(['noSync']);
    expect(
      ids(body(OK + '\n', 'await reorderOrderStatus({ data: { id } });')),
      'порожній рядок між',
    ).toEqual(['noSync']);
    expect(
      ids(
        body(
          '// no-cache-sync-ok: x',
          'await reorderOrderStatus({ data: { id } });',
        ),
      ),
      'чужий префікс',
    ).toEqual(['noSync']);
  });

  it('useMutation з винесеним const-конфігом — резолвиться; нерезолвний — явний репорт', () => {
    expect(
      ids(`export function Page() {
      const collection = useCollection(orderStatusesCollection);
      const opts = { mutationFn: (id) => setDefaultOrderStatus({ data: { id } }), onSuccess: () => collection.utils.refetch() };
      const m = useMutation(opts);
      return null;
    }`),
    ).toEqual([]);
    expect(
      ids(`export function Page() {
      const opts = { mutationFn: async (x) => fetch('/api', { body: x }) };
      const m = useMutation(opts);
      return null;
    }`),
    ).toEqual(['noSync']);
    expect(
      ids(
        `export function Page() { const m = useMutation(getOpts()); return null; }`,
      ),
    ).toEqual(['unresolvedConfig']);
  });

  it('persistence-виняток лише всередині фабрики колекції', () => {
    expect(
      ids(
        `export const callbacks = { onInsert: () => setDefaultOrderStatus({ data: { id: 'a' } }) };`,
      ),
    ).toEqual(['noSync']);
  });

  it('колекція Task 9 (serverFn у persistence-хендлерах) — чиста', () => {
    expect(
      ids(
        `function create(queryClient) {
      const collection = createCollection(queryCollectionOptions({
        queryFn: async () => listOrderStatuses({ data: {} }),
        onInsert: async ({ transaction }) => {
          const rows = await insertOrderStatuses({ data: transaction.mutations.map((m) => m.modified) });
          collection.utils.writeBatch(() => { for (const row of rows) collection.utils.writeUpsert(row); });
          return { refetch: false };
        },
      }));
      return collection;
    }`,
        `import { insertOrderStatuses, listOrderStatuses } from 'simplycms/admin-server';\n`,
      ),
    ).toEqual([]);
  });

  it('loader з list — поза правилом', () => {
    expect(
      ids(
        `export const Route = { loader: async () => { await listOrderStatuses({ data: {} }); return null; } };`,
        `import { listOrderStatuses } from 'simplycms/admin-server';\n`,
      ),
    ).toEqual([]);
  });

  it('отримувач з іншим іменем (statuses = useCollection) — рахується синком', () => {
    expect(
      ids(`export function Page() {
      const statuses = useCollection(orderStatusesCollection);
      const handleCreate = (form) => { statuses.insert({ id: 'x', ...form }); };
      const m = useMutation({ mutationFn: (id) => setDefaultOrderStatus({ data: { id } }), onSuccess: () => statuses.utils.refetch() });
      return null;
    }`),
    ).toEqual([]);
  });

  it('serverFn у JSX inline-arrow без синку — офендер', () => {
    expect(
      ids(
        `export function Page() { return <button onClick={() => setDefaultOrderStatus({ data: { id: 'a' } })} />; }`,
      ),
    ).toEqual(['noSync']);
  });
});
