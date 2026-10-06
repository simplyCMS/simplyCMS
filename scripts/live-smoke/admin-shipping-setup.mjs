/**
 * Підготовка кроку доставки К3-Е6а (`./admin-shipping.mjs`) — окремим
 * модулем за каноном 150 рядків: доказ setDefault зони, створення способів,
 * тарифу й точки власником, відмови видалення 409. Дані кроку (`fx`) і стан
 * (`st`, його читає прибирання) передає оркестрація.
 */
import * as sqlx from './admin-shipping-sql.mjs';
import * as ui from './admin-shipping-owner.mjs';

/** setDefault: тестова зона стає дефолтною (бейдж і БД), потім дефолт повертається «Україні». */
export async function zoneDefaultPart({ page, base, dbUrl, check, fx: FX }) {
  const names = [FX.zone, FX.rate.zone];
  const read = () => sqlx.zonesByName(dbUrl, names);
  const isDef = (rows, n) =>
    rows.find((r) => r.name === n)?.is_default === true;
  await ui.createZone(page, base, FX.zone);
  const t1 = await ui.makeDefault(page, FX.zone);
  const db1 = await sqlx.pollUntil(read, (r) => isDef(r, FX.zone));
  const badge1 =
    (await ui.hasDefaultBadge(page, FX.zone)) &&
    !(await ui.hasDefaultBadge(page, FX.rate.zone));
  const t2 = await ui.makeDefault(page, FX.rate.zone);
  const db2 = await sqlx.pollUntil(read, (r) => isDef(r, FX.rate.zone));
  const badge2 =
    (await ui.hasDefaultBadge(page, FX.rate.zone)) &&
    !(await ui.hasDefaultBadge(page, FX.zone));
  await ui.deleteRow(page, FX.zone);
  const db3 = await sqlx.pollUntil(read, (r) => r.length === 1);
  check(
    'доставка: setDefault — бейдж і is_default переходять на «Е6а-тест» і назад на «Україна», тестову зону видалено',
    t1 &&
      t2 &&
      badge1 &&
      badge2 &&
      isDef(db1, FX.zone) &&
      !isDef(db1, FX.rate.zone) &&
      isDef(db2, FX.rate.zone) &&
      db3.length === 1 &&
      isDef(db3, FX.rate.zone),
    `тости ${t1}/${t2}; бейдж ${badge1}/${badge2}; БД ${JSON.stringify(db1)} → ${JSON.stringify(db2)} → ${JSON.stringify(db3)}`,
  );
}

/** Власник створює способи, тариф і точку; SQL кладе залишок товару на точку. */
export async function createPart({ page, base, dbUrl, check, fx: FX, st }) {
  const created = await ui.createMethod(page, base, FX.pickup);
  st.pickup = await sqlx.pollUntil(
    () => sqlx.methodByCode(dbUrl, FX.pickup.code),
    Boolean,
  );
  await page.waitForURL(`${base}/admin/shipping/methods/${st.pickup.id}`, {
    timeout: 15_000,
  });
  await ui.addRate(page, FX.rate);
  const rates = await sqlx.pollUntil(
    () => sqlx.ratesOf(dbUrl, st.pickup.id),
    (r) => r.length === 1,
  );
  await ui.createPoint(page, base, { ...FX.point, methodName: FX.pickup.name });
  st.point = await sqlx.pollUntil(
    () => sqlx.pointByName(dbUrl, FX.point.name),
    Boolean,
  );
  st.stockRowId = await sqlx.seedPointStock(dbUrl, st.point.id, FX.slug, 5);
  check(
    'доставка: власник створив «Самовивіз Е6а» (core:pickup, rates), тариф flat 50 і точку цього способу',
    created &&
      st.pickup.provider === 'core:pickup' &&
      st.pickup.pricing === 'rates' &&
      rates.length === 1 &&
      rates[0].calculation_type === 'flat' &&
      Number(rates[0].base_cost) === 50 &&
      st.point.method_id === st.pickup.id,
    `спосіб ${JSON.stringify(st.pickup)}; тарифи ${JSON.stringify(rates)}; точка → ${st.point.method_id}`,
  );
  const courierToast = await ui.createMethod(page, base, FX.courier);
  st.courier = await sqlx.pollUntil(
    () => sqlx.methodByCode(dbUrl, FX.courier.code),
    Boolean,
  );
  check(
    "доставка: власник створив «Кур'єр» (core:address, carrier)",
    courierToast &&
      st.courier?.provider === 'core:address' &&
      st.courier?.pricing === 'carrier',
    JSON.stringify(st.courier),
  );
}

/** Відмови видалення: спосіб із точкою → «використовується»; точка із залишком → тост. */
export async function refusalPart({ page, base, dbUrl, check, fx: FX, st }) {
  const mToast = await ui.tryDelete(
    page,
    base,
    'methods',
    FX.pickup.name,
    'Запис використовується',
  );
  const m = await sqlx.methodByCode(dbUrl, FX.pickup.code);
  const p = await sqlx.pointByName(dbUrl, FX.point.name);
  const rates = await sqlx.ratesOf(dbUrl, st.pickup.id);
  check(
    'доставка: видалення «Самовивіз Е6а» з точкою → тост «використовується», спосіб, точка й тариф на місці',
    mToast && !!m && !!p && rates.length === 1,
    `тост=${mToast}, спосіб=${!!m}, точка=${!!p}, тарифів ${rates.length}`,
  );
  const pToast = await ui.tryDelete(
    page,
    base,
    'pickup-points',
    FX.point.name,
    'На точці є залишок',
  );
  const p2 = await sqlx.pointByName(dbUrl, FX.point.name);
  const qty = await sqlx.stockRowQty(dbUrl, st.stockRowId);
  check(
    'доставка: видалення точки із залишком → тост pickup_point_has_stock, точка й залишок на місці',
    pToast && !!p2 && qty === 5,
    `тост=${pToast}, точка=${!!p2}, залишок ${qty}`,
  );
}
