/**
 * Підготовка й перші дві частини кроку К3-Е6г (`./admin-customers.mjs`):
 * два нові покупці у власних context-ах, фікстура залишку, тимчасові
 * категорії з автоправилом — і доведення «контакти й email» та «ручна
 * категорія не зсувається автоправилом» (A) з контролем, що правило живе (B).
 */
import { register } from './register.mjs';
import { bumpStock } from './admin-discounts-sql.mjs';
import { pollUntil } from './admin-shipping-sql.mjs';
import * as q from './admin-customers-sql.mjs';
import { seedRule } from './admin-customers-seed.mjs';
import * as ui from './admin-customers-owner.mjs';
import * as buyer from './admin-customers-buyer.mjs';

/** Реєструє A і B (свої context-и), засіває правило, піднімає залишок на 2. */
export async function prepare({ pages, base, dbUrl, fx, st }) {
  for (const who of ['a', 'b']) {
    const email = await register(pages[who], base);
    const user = await q.userByEmail(dbUrl, email);
    st[who] = { email, userId: user.id };
  }
  st.ids = await seedRule(dbUrl, fx);
  st.stock = await bumpStock(dbUrl, fx.slug, 2);
  st.productId = await q.productId(dbUrl, fx.slug);
}

/** Власник знаходить A пошуком, міняє імʼя й email → A виходить і входить новим. */
export async function contactsPart({
  page,
  pages,
  base,
  dbUrl,
  check,
  fx,
  st,
}) {
  const oldEmail = st.a.email;
  const opened = await ui.openFromList(page, base, st.a.email);
  const saved = await ui.saveContacts(page, {
    firstName: fx.newName,
    email: fx.newEmail,
  });
  const next = fx.newEmail.toLowerCase();
  const user = await pollUntil(() => q.userByEmail(dbUrl, next), Boolean);
  const profile = user && (await q.profileOf(dbUrl, user.id));
  check(
    'покупці: власник знайшов A пошуком і змінив імʼя та email — users і profiles мають новий email у нижньому регістрі',
    opened.found === 1 &&
      saved &&
      user?.id === st.a.userId &&
      profile?.first_name === fx.newName &&
      profile.email === next,
    `знайдено ${opened.found}; тост ${saved}; users ${user?.email}; profiles ${profile?.email}/${profile?.first_name}`,
  );
  st.a.email = next;
  const status = await buyer.signOut(pages.a);
  const guest = await buyer.sessionOf(pages.a);
  const oldRejected = await buyer.loginAs(
    pages.a,
    base,
    oldEmail,
    'Невірний email або пароль',
  );
  const ok = await buyer.loginAs(pages.a, base, next);
  const session = await buyer.sessionOf(pages.a);
  check(
    'покупці: A вийшов, зі старим email вхід відмовлено, з новим — увійшов (сесія на новий email)',
    status === 200 &&
      guest === null &&
      oldRejected &&
      ok &&
      session?.user?.email === next,
    `вихід ${status}, гість ${guest === null}, старий email відмовлено ${oldRejected}, сесія ${session?.user?.email}`,
  );
}

/** Закріплена вручну категорія A переживає автоправило; B (контроль) — ні. */
export async function categoryPart({
  page,
  pages,
  base,
  dbUrl,
  check,
  fx,
  st,
}) {
  const toast = await ui.pinCategory(page, base, st.a.userId, fx.pin.name);
  const pinned = await q.profileOf(dbUrl, st.a.userId);
  const orderA = await buyer.placeOrder({
    page: pages.a,
    base,
    dbUrl,
    slug: fx.slug,
  });
  st.a.orderId = orderA.orderId;
  st.orders.push(orderA.orderId);
  const orderB = await buyer.placeOrder({
    page: pages.b,
    base,
    dbUrl,
    slug: fx.slug,
  });
  st.orders.push(orderB.orderId);
  // Контроль: правило живе — незакріплений B переходить у «авто».
  const b = await pollUntil(
    () => q.profileOf(dbUrl, st.b.userId),
    (p) => p?.category_id === st.ids.auto,
  );
  const a = await q.profileOf(dbUrl, st.a.userId);
  const history = await q.historyOf(dbUrl, st.a.userId);
  check(
    'покупці: категорія A закріплена вручну — після замовлення (автоправило ≥1 замовлення) лишилась, історія лише ручна; контроль: незакріплений B перейшов у «авто» за правилом',
    toast &&
      pinned?.category === fx.pin.name &&
      pinned.category_locked &&
      a?.category_id === st.ids.pin &&
      a.category_locked &&
      history.length === 1 &&
      history[0].rule_id === null &&
      b?.category_id === st.ids.auto,
    `тост ${toast}; A: ${a?.category} (блок ${a?.category_locked}); історія A ${JSON.stringify(history)}; B: ${b?.category}`,
  );
}
