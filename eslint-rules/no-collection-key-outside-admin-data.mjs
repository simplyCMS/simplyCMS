import { dirname, resolve } from 'node:path';

/**
 * `collectionKey` — лише для колекцій `admin-data` (Е3-15′, рішення
 * архітектора: власне правило, не тір-зона й не `query-key-from-entity` —
 * та ловить ЛІТЕРАЛИ в `queryKey`, а не сам факт імпорту функції).
 *
 * 🔴 Не стилістика: write-back перезаписує ПРЕФІКСНО всі ключі, що
 * розширюють `collectionKey(entity)` — вітрина й `admin-data` ділять ОДИН
 * `QueryClient`. Поза `admin-data` — `entityKey(x).variant()`/`.scoped()`
 * (доказ механіки — `admin-data/__tests__/
 * collection-key-storefront-isolation.test.ts`).
 * UPSTREAM:TSDB-1 — docs/architecture/upstream-workarounds.md
 *
 * Зона (файли, де правило АКТИВНЕ) — блок у `eslint.config.mjs`: увесь
 * `packages/simplycms/src/**` (+ референс-тема/плагін) КРІМ `admin-data/**`
 * і `__tests__/**` — саме правило шляхів не знає, як і сусідні
 * `no-direct-storage`/`no-server-only-in-client`.
 *
 * Ловить: `import { collectionKey }` (і `import type`/inline `type`) та
 * `export { collectionKey } from …` — джерело: bare `simplycms/contracts/
 * entities` або БУДЬ-ЯКА відносна форма, що резолвиться в той самий файл.
 *
 * 🔴 Межа: namespace-імпорт (`import * as e from '…entities'` →
 * `e.collectionKey`) не ловиться — той самий клас дірки, що в динамічного
 * `import()` по репо (нульова популяція сьогодні; `eslint.tier-zones.mjs`).
 */

const ENTITIES_FILE = resolve(
  import.meta.dirname,
  '../packages/simplycms/src/contracts/entities.ts',
).replace(/\.ts$/, '');

const BARE_SPECIFIER = 'simplycms/contracts/entities';

function targetsEntitiesModule(source, filename) {
  if (source === BARE_SPECIFIER) return true;
  if (!source.startsWith('.')) return false;
  return resolve(dirname(filename), source) === ENTITIES_FILE;
}

const MESSAGE =
  'collectionKey належить ВИКЛЮЧНО колекціям admin-data (Е3-15′): write-back ' +
  'по ньому перезаписує ПРЕФІКСНО всі ключі, що його розширюють ' +
  '(query-db-collection findAll). Поза admin-data — entityKey(x).variant()/.scoped().';

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    schema: [],
    messages: { forbidden: MESSAGE },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (
          typeof source !== 'string' ||
          !targetsEntitiesModule(source, context.filename)
        )
          return;
        for (const spec of node.specifiers) {
          if (
            spec.type === 'ImportSpecifier' &&
            spec.imported.type === 'Identifier' &&
            spec.imported.name === 'collectionKey'
          ) {
            context.report({ node: spec, messageId: 'forbidden' });
          }
        }
      },
      ExportNamedDeclaration(node) {
        const source = node.source?.value;
        if (
          typeof source !== 'string' ||
          !targetsEntitiesModule(source, context.filename)
        )
          return;
        for (const spec of node.specifiers) {
          if (
            spec.local.type === 'Identifier' &&
            spec.local.name === 'collectionKey'
          ) {
            context.report({ node: spec, messageId: 'forbidden' });
          }
        }
      },
      // `export * from '…entities'` транзитивно тягне collectionKey теж —
      // конкретного специфікатора тут немає, звітуємо на весь вузол.
      ExportAllDeclaration(node) {
        const source = node.source.value;
        if (
          typeof source === 'string' &&
          targetsEntitiesModule(source, context.filename)
        ) {
          context.report({ node, messageId: 'forbidden' });
        }
      },
    };
  },
};
