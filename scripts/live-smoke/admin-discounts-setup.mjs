/**
 * Підготовка кроку знижок К3-Е6в (`./admin-discounts.mjs`) — окремим
 * модулем за каноном 150 рядків: власник у браузері створює групу «поріг»
 * з ДОЧІРНЬОЮ групою (вкладеність — щоб вимкнення батька мало що
 * стримувати, ред.2), знижку «від 3 шт» у дочірній, категорію «VIP»,
 * знижку для неї в окремій групі й автоправило. SQL доводить, що форми
 * записали саме це. Id створеного кладуться в `st` — їх читає прибирання.
 */
import { pollUntil } from './admin-shipping-sql.mjs';
import * as q from './admin-discounts-sql.mjs';
import * as ui from './admin-discounts-owner.mjs';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Групи: «поріг» (корінь, `and`), «поріг / дитина» (`and`, батько — «поріг»), «VIP» (корінь). */
async function groupsPart({ page, base, dbUrl, check, fx, st }) {
  const names = [fx.parent, fx.child, fx.vipGroup];
  const t1 = await ui.createGroup(page, base, fx.parent);
  const parent = await pollUntil(
    () => q.groupsByName(dbUrl, [fx.parent]),
    (r) => r.length === 1,
  );
  const t2 = await ui.createGroup(page, base, fx.child, parent[0]?.id);
  const t3 = await ui.createGroup(page, base, fx.vipGroup);
  const rows = await pollUntil(
    () => q.groupsByName(dbUrl, names),
    (r) => r.length === 3,
  );
  const by = Object.fromEntries(rows.map((g) => [g.name, g]));
  st.ids = { child: by[fx.child]?.id, vipGroup: by[fx.vipGroup]?.id };
  check(
    'знижки: власник створив групу «Е6в поріг» з дочірньою «Е6в поріг / дитина» і окрему «Е6в VIP» — усі and, активні',
    t1 &&
      t2 &&
      t3 &&
      rows.length === 3 &&
      rows.every((g) => g.operator === 'and' && g.is_active) &&
      by[fx.parent]?.parent === null &&
      by[fx.child]?.parent === fx.parent &&
      by[fx.vipGroup]?.parent === null,
    `тости ${t1}/${t2}/${t3}; ${rows.map((g) => `${g.name} ← ${g.parent ?? 'корінь'}`).join('; ')}`,
  );
}

/** Знижка «Від 3 шт −10%» у дочірній групі: ціль — товар, умова `min_quantity >= 3`. */
async function thresholdDiscountPart({ page, base, dbUrl, check, fx, st }) {
  const d = fx.threshold;
  const toast = await ui.createDiscount(page, base, {
    ...d,
    groupId: st.ids.child,
    sku: fx.sku,
    hit: fx.hit,
  });
  const row = await pollUntil(() => q.discountByName(dbUrl, d.name), Boolean);
  check(
    'знижки: «Від 3 шт −10%» — у дочірній групі, percent 10, усі типи цін, ціль — товар, умова min_quantity >= 3',
    toast &&
      row?.group_name === fx.child &&
      row.discount_type === 'percent' &&
      Number(row.value) === d.value &&
      row.price_type_id === null &&
      same(row.targets, [{ type: 'product', id: st.productId }]) &&
      same(row.conditions, [{ type: 'min_quantity', op: '>=', value: 3 }]),
    `тост ${toast}; ${JSON.stringify(row)}`,
  );
}

/** Категорія «VIP Е6в» і знижка «VIP −15%» з умовою `user_category in [VIP]`. */
async function vipPart({ page, base, dbUrl, check, fx, st }) {
  const t1 = await ui.createCategory(
    page,
    base,
    fx.category.name,
    fx.category.code,
  );
  const category = await pollUntil(
    () => q.categoryByCode(dbUrl, fx.category.code),
    Boolean,
  );
  st.ids.category = category?.id;
  const t2 = await ui.createDiscount(page, base, {
    ...fx.vip,
    groupId: st.ids.vipGroup,
    sku: fx.sku,
    hit: fx.hit,
    category: fx.category.name,
  });
  const row = await pollUntil(
    () => q.discountByName(dbUrl, fx.vip.name),
    Boolean,
  );
  check(
    'знижки: категорія «VIP Е6в» і знижка «VIP −15%» в окремій групі з умовою user_category in [VIP Е6в]',
    t1 &&
      t2 &&
      category?.is_default === false &&
      row?.group_name === fx.vipGroup &&
      Number(row.value) === fx.vip.value &&
      same(row.conditions, [
        { type: 'user_category', op: 'in', value: [category.id] },
      ]),
    `тости ${t1}/${t2}; категорія ${category?.id}; ${JSON.stringify(row?.conditions)}`,
  );
}

/** Правило «2+ замовлення → VIP Е6в» з «Роздріб», `orders_count >= 2`. */
async function rulePart({ page, base, dbUrl, check, fx, st }) {
  const toast = await ui.createRule(page, base, {
    ...fx.rule,
    to: fx.category.name,
  });
  const rule = await pollUntil(
    () => q.ruleByName(dbUrl, fx.rule.name),
    Boolean,
  );
  st.ids.rule = rule?.id;
  const c = rule?.conditions;
  check(
    'знижки: правило «2+ замовлення → VIP Е6в» — з «Роздріб», orders_count >= 2',
    toast &&
      rule?.from_name === fx.rule.from &&
      rule.to_name === fx.category.name &&
      c?.rules?.length === 1 &&
      c.rules[0].field === 'orders_count' &&
      c.rules[0].operator === '>=' &&
      Number(c.rules[0].value) === fx.rule.value,
    `тост ${toast}; ${rule?.from_name} → ${rule?.to_name}; ${JSON.stringify(c)}`,
  );
}

/** Уся підготовка власника — у порядку залежностей (категорія — до її умови). */
export async function setupPart(args) {
  await groupsPart(args);
  await thresholdDiscountPart(args);
  await vipPart(args);
  await rulePart(args);
}
