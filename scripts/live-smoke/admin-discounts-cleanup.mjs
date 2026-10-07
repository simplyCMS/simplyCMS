/**
 * Прибирання кроку знижок К3-Е6в (`finally` у `./admin-discounts.mjs`) —
 * САМЕ в цьому порядку, бо кожен крок знімає перешкоду наступному:
 * (1) SQL: покупця назад у категорію з реєстрації (інакше категорію не
 * видалити: `user_category_has_customers`); (2) видалити правило (FK
 * RESTRICT і `user_category_has_rules`); (3) видалити групи — каскад знижок,
 * а з ним і умови `user_category` (`user_category_in_discount`); (4) видалити
 * категорію «VIP Е6в» — історія лишається з `NULL` і знімком назви (Е6в-2).
 * Далі — фікстура залишку назад і фінальні асерти. Тестові замовлення
 * лишаються.
 *
 * 🔴 Стійкість до часткового стану: основна частина могла впасти будь-де.
 * Кожна дія — у власному `try` і лише якщо запис існує (SQL): відсутній
 * запис пропускається з приміткою, а збій одного не зриває решту.
 */
import * as q from './admin-discounts-sql.mjs';
import * as ui from './admin-discounts-owner.mjs';

/** Виконує `action`, якщо `exists`; факт — «що: результат». */
async function attempt(facts, what, exists, action) {
  try {
    if (!(await exists())) {
      facts.push(`${what}: немає — пропущено`);
      return true;
    }
    const result = await action();
    facts.push(`${what}: ${JSON.stringify(result)}`);
    return result === true || result?.toast === true;
  } catch (e) {
    facts.push(`${what}: виняток ${e.message}`);
    return false;
  }
}

/** (1)–(4) у каноні; кожна дія — незалежно від результату попередніх. */
async function dropConfig({ page, base, dbUrl, check, fx, st }) {
  const facts = [];
  const rule = () => q.ruleByName(dbUrl, fx.rule.name);
  const category = () => q.categoryByCode(dbUrl, fx.category.code);
  const group = (name) => async () =>
    (await q.groupsByName(dbUrl, [name])).length > 0;
  const steps = [
    [
      '(1) покупець у вихідну категорію',
      async () => Boolean(st.buyer?.userId),
      async () => {
        const { userId, categoryId, email } = st.buyer;
        await q.resetCustomerCategory(dbUrl, userId, categoryId);
        const p = await q.profileByEmail(dbUrl, email);
        return p?.category_id === categoryId && !p.category_locked;
      },
    ],
    [
      '(2) правило',
      rule,
      async () =>
        ui.deleteFromCard(
          page,
          base,
          `user-categories/rules/${(await rule()).id}`,
          'Правило видалено',
        ),
    ],
    ...[fx.parent, fx.vipGroup].map((name) => [
      `(3) група «${name}»`,
      group(name),
      () => ui.deleteGroup(page, base, name),
    ]),
    [
      '(4) категорія',
      category,
      async () =>
        ui.deleteFromCard(
          page,
          base,
          `user-categories/${(await category()).id}`,
          'Категорію видалено',
        ),
    ],
  ];
  // 🔴 Не `ok &&= await …`: коротке замикання пропустило б решту прибирання.
  const results = [];
  for (const [what, exists, action] of steps)
    results.push(await attempt(facts, what, exists, action));
  check(
    'прибирання знижок: (1) покупець у вихідній категорії → (2) правило → (3) групи каскадом → (4) категорія — через адмінку',
    results.every(Boolean),
    facts.join('; '),
  );
}

/** Фікстура залишку — як до кроку; на зеленому прогоні два замовлення по 3 вже її спожили. */
async function dropStock({ dbUrl, check, st }) {
  const label = 'прибирання знижок: залишок товару — як до кроку';
  if (!st.stock) {
    check(label, false, 'фікстуру залишку не поставлено — крок упав раніше');
    return;
  }
  try {
    const r = await q.restoreStock(dbUrl, st.stock);
    check(label, r.now === st.stock.quantity, `було ${r.was} → ${r.now}`);
  } catch (e) {
    check(label, false, `виняток: ${e.message}`);
  }
}

/** Нічого тестового не лишилось; історія пережила видалення категорії й правила. */
async function assertClean({ dbUrl, check, fx, st }) {
  const groups = await q.groupsByName(dbUrl, [
    fx.parent,
    fx.child,
    fx.vipGroup,
  ]);
  const discounts = await Promise.all(
    [fx.threshold.name, fx.vip.name].map((n) => q.discountByName(dbUrl, n)),
  );
  const rule = await q.ruleByName(dbUrl, fx.rule.name);
  const category = await q.categoryByCode(dbUrl, fx.category.code);
  const history = st.buyer?.userId
    ? await q.historyOf(dbUrl, st.buyer.userId)
    : [];
  check(
    'прибирання знижок: груп, знижок, правила й категорії немає; історія лишилась — to_category_id і rule_id NULL, назва зі знімка',
    groups.length === 0 &&
      discounts.every((d) => d === null) &&
      rule === null &&
      category === null &&
      history.length === (st.historyExpected ?? 0) &&
      history.every(
        (h) =>
          h.to_category_id === null &&
          h.rule_id === null &&
          h.to_category_name === fx.category.name,
      ),
    `груп ${groups.length}, знижок ${discounts.filter(Boolean).length}, правило ${rule?.id ?? '—'}, категорія ${category?.id ?? '—'}; історія ${JSON.stringify(history)}`,
  );
}

export async function cleanupDiscountsStep(args) {
  await dropConfig(args);
  await dropStock(args);
  try {
    await assertClean(args);
  } catch (e) {
    args.check('прибирання знижок: стан демо', false, `виняток: ${e.message}`);
  }
}
