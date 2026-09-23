import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { QueryClient } from '@tanstack/react-query';
import {
  ENTITY,
  entityKey,
} from '../packages/simplycms/src/contracts/entities';

/**
 * Голий `entityKey(X).list()` належить ЛИШЕ колекціям `admin-data`
 * (Е3-15): вітрина й адмінка ділять ОДИН `QueryClient` (`src/router.tsx`),
 * а eager-колекція без demand-суфікса пише рівно в `[entity,'list']`. Тому
 * вітринний запит під тим самим голим ключем читав би чужу форму рядка —
 * живий дефект був для `order_statuses` (колекція Е1б × `ProfileOrders.tsx`)
 * до фіксу цим Step 0.
 *
 * 🔴 Ловимо лише `queryKey: <ідентифікатор>.list()` як ЦІЛИЙ вираз
 * значення властивості — НЕ спред (`[...x.list(), 'suffix']` не збігається
 * з базовим ключем колекції побайтно, а тому не колізія, і план прямо
 * каже його не чіпати).
 */
const ROOT = join(import.meta.dirname, '../packages/simplycms/src');
const EXCLUDED_DIR_NAMES = new Set(['admin-data', '__tests__']);

function* tsFiles(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (EXCLUDED_DIR_NAMES.has(e.name)) continue;
      yield* tsFiles(join(dir, e.name));
    } else if (e.isFile() && /\.tsx?$/.test(e.name)) {
      yield join(dir, e.name);
    }
  }
}

/** `queryKey: <ідентифікатор>.list()` — самé значення, не в масиві/спреді. */
function isBareListCall(value: ts.Expression): boolean {
  return (
    ts.isCallExpression(value) &&
    ts.isPropertyAccessExpression(value.expression) &&
    value.expression.name.text === 'list' &&
    ts.isIdentifier(value.expression.expression)
  );
}

function offendersIn(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
  const out: string[] = [];

  const visit = (n: ts.Node) => {
    if (
      ts.isPropertyAssignment(n) &&
      n.name.getText(sf) === 'queryKey' &&
      isBareListCall(n.initializer)
    ) {
      out.push(
        `${relative(process.cwd(), file)}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`,
      );
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

describe('bare-list-key: голий entityKey(X).list() — лише в admin-data (Е3-15)', () => {
  it('офендерів немає поза admin-data (BASELINE порожній назавжди)', () => {
    const offenders = [...tsFiles(ROOT)].flatMap(offendersIn);
    expect(offenders).toEqual([]);
  });
});

// 🔴 Негативний контроль колізії (Е3-15, п.4): та сама пастка, яку жив
// дефект у `main` доводив для `order_statuses` до фіксу Step 0 — колекція
// `admin-data` і вітринний запит під ОДНИМ голим `.list()` в ОДНОМУ
// QueryClient. `variant('storefront')` розводить їх фізично: колекція не
// пише у вітринний ключ.
vi.mock('simplycms/admin-server', () => ({
  listOrderStatuses: vi.fn(async () => []),
  insertOrderStatuses: vi.fn(),
  updateOrderStatuses: vi.fn(),
  removeOrderStatuses: vi.fn(),
}));

describe('колізія ключів вітрини й колекцій', () => {
  it("колекція orderStatuses не пише у вітринний variant('storefront')", async () => {
    const { getCollection } =
      await import('../packages/simplycms/src/admin-data/registry');
    const { orderStatusesCollection } =
      await import('../packages/simplycms/src/admin-data/collections/order-statuses');
    const qc = new QueryClient();
    await getCollection(qc, orderStatusesCollection).preload();
    expect(
      qc.getQueryData(entityKey(ENTITY.orderStatuses).variant('storefront')),
    ).toBeUndefined();
  });
});
