/**
 * Браузерна воронка живого прогону: реєстрація → картка → кошик → чекаут →
 * СКАСУВАННЯ. Єдиний споживач Playwright; оркестрація його не імпортує.
 *
 * Реєстрація винесена в `./register.mjs` (контингент брифа Task 14: з
 * доказом М-12 «підсумок = замовлення» цей файл переріс би канон 150 рядків;
 * `register` самодостатня й ні від чого тут не залежить), а селектори й
 * розбір чисел — у `./selectors.mjs`: це контракт РОЗМІТКИ, який живе своїм
 * життям від кроків сценарію.
 */
import { register } from './register.mjs';
import {
  activePickupPoints,
  orderStatusCode,
  orderTotal,
  ordersCount,
  stockSnapshot,
} from './sql.mjs';
import { badgeTextFor, jsonLdAvailabilityFor } from './stock-labels.mjs';
import { FIELD, PRODUCT_SLUG, parseMoney } from './selectors.mjs';

/**
 * Уся воронка одним викликом: `page` — сторінка Playwright, `base` — URL
 * піднятого магазину, `dbUrl` — та сама БД прямим SQL, `check` — збирач
 * фактів оркестрації (вердикт + ФАКТ, як у гейтах пілота).
 */
export async function runFunnel({ page, base, dbUrl, check }) {
  const goto = (path) =>
    page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  await register(page, base);
  const before = await stockSnapshot(dbUrl, PRODUCT_SLUG);

  // 1. Картка: бейдж і JSON-LD проти БД (те, чого curl не бачить).
  await goto(`/catalog/${before.section}/${PRODUCT_SLUG}`);
  const badge =
    (await page
      .locator('text=/В наявності|Немає в наявності|Під замовлення/')
      .first()
      .textContent()) ?? '';
  const expectedBadgeText = badgeTextFor(before.status);
  const badgeOk = badge.includes(expectedBadgeText);
  const badgeFact = `stock_status=${before.status}, залишок ${before.total}, очікували «${expectedBadgeText}», бейдж «${badge.trim()}»`;
  check('бейдж = БД', badgeOk, badgeFact);
  const jsonLd =
    (await page
      .locator('script[type="application/ld+json"]')
      .first()
      .textContent()) ?? '';
  const expectedAvailability = jsonLdAvailabilityFor(before.status);
  const actualAvailability = jsonLd.match(/schema\.org\/\w+/)?.[0] ?? '—';
  check(
    'JSON-LD availability',
    jsonLd.includes(expectedAvailability),
    `stock_status=${before.status}, очікували ${expectedAvailability}, отримали ${actualAvailability}`,
  );

  // 2. Кошик і сторінки з НЕПОРОЖНІМ кошиком (гідратація — Е0-5).
  const addToCart = page.getByRole('button', { name: /Додати в кошик/ });
  await addToCart.first().click();
  for (const path of ['/', '/catalog', '/cart']) await goto(path);

  // 3. Чекаут → рядок в `orders` зі списанням.
  const ordersBefore = await ordersCount(dbUrl);
  await goto('/checkout');
  // 🔴 Спершу дочекатись префілу з профілю: `getProfileSettings` заповнює
  // форму в `useEffect`, тож `fill` до нього був би затертий після нього.
  // 🔴 Саме `?? ''`: доки поля ще немає в DOM, `?.value` — `undefined`, і
  // предикат `?.value !== ''` пройшов би ЩЕ ДО рендеру форми — чекання
  // виродилось би в no-op рівно в тому випадку, заради якого існує.
  await page.waitForFunction(
    (sel) => (document.querySelector(sel)?.value ?? '') !== '',
    FIELD.firstName,
  );
  const firstName = await page.locator(FIELD.firstName).inputValue();
  check('чекаут префілено профілем покупця', firstName === 'Тест', firstName);
  await page.locator(FIELD.phone).fill('+380501234567');
  // Демо-метод — pickup з однією точкою: метод і точку форма обирає сама
  // (Task 11); smoke це доводить, а не клікає замість покупця.
  const points = await activePickupPoints(dbUrl);
  const onePoint = points.length === 1 && points[0].is_system === true;
  const pointsFact = `точок ${points.length}, is_system ${points.map((p) => p.is_system).join(',')}`;
  check(
    'демо: одна активна точка видачі, вона ж системна',
    onePoint,
    pointsFact,
  );
  const pickedPoint = await page.locator(FIELD.pickupPoint).inputValue();
  check(
    'єдина точка видачі обрана автоматично',
    pickedPoint !== '',
    pickedPoint,
  );
  // М-12: підсумок читаємо тут, ДО сабміту (`#checkout-total` зʼявляється,
  // коли квота `prepareCheckout` вляглась — ЧЕКАННЯ заодно доводить, що
  // submit на цей момент розблокований). Ліве плече рівності «показане =
  // записане» — саме число з екрана, праве — рядок в `orders` нижче.
  await page.locator(FIELD.total).waitFor();
  const totalText = await page.locator(FIELD.total).textContent();
  const displayedTotal = parseMoney(totalText);
  await page.getByRole('button', { name: /Підтвердити замовлення/ }).click();
  await page.waitForURL(/\/order-success\//, { timeout: 15_000 });
  await page.waitForLoadState('networkidle');
  const orderId = /order-success\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? '';
  const ordersAfter = await ordersCount(dbUrl);
  const placed = await stockSnapshot(dbUrl, PRODUCT_SLUG);
  check(
    'orders +1',
    ordersAfter === ordersBefore + 1,
    `${ordersBefore} → ${ordersAfter}`,
  );
  // Демо вмикає decrease_on_order (Task 7): списання — безумовне очікування.
  const stockFact = `${before.total} → ${placed.total}, точка ${pickedPoint}`;
  check('списання залишку', placed.total === before.total - 1, stockFact);
  const recordedTotal = await orderTotal(dbUrl, orderId);
  const totalsMatch =
    recordedTotal !== null && Math.abs(recordedTotal - displayedTotal) < 0.01;
  check(
    'підсумок = замовлення',
    totalsMatch,
    `підсумок чекауту ${displayedTotal}, orders.total ${recordedTotal}`,
  );

  // 4. Скасування в кабінеті → ПОВЕРНЕННЯ залишку (Р1, Task 9).
  await goto(`/profile/orders/${orderId}`);
  await page.getByRole('button', { name: 'Скасувати', exact: true }).click();
  await page.getByRole('button', { name: /Так, скасувати/ }).click();
  await page.waitForURL(/\/profile\/orders$/, { timeout: 15_000 });
  const released = await stockSnapshot(dbUrl, PRODUCT_SLUG);
  const statusCode = await orderStatusCode(dbUrl, orderId);
  check(
    'замовлення скасовано',
    statusCode === 'cancelled',
    `status → ${statusCode}`,
  );
  // 🔴 Рівність ЗНІМКІВ, а не сум: повертається та сама точка, і статус теж
  // мусить відкотитись (асиметрія «списали й не повернули» — саме той стан,
  // через який демо показував нуль залишку при нулі продажів).
  const returned = JSON.stringify(released) === JSON.stringify(before);
  const returnFact = `${placed.total} → ${released.total}, stock_status ${placed.status} → ${released.status}`;
  check('повернення залишку і статусу', returned, returnFact);
}
