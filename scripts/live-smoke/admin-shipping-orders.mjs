/**
 * Замовлення кроку доставки К3-Е6а (`./admin-shipping.mjs`): покупець
 * оформлює «Кур'єром» і самовивозом на нову точку, власник перейменовує
 * точку — картка адмінки й кабінет показують назву зі знімка. Окремим
 * модулем за каноном 150 рядків; дані кроку (`fx`) передає оркестрація.
 */
import { stockSnapshot } from './sql.mjs';
import {
  orderShipping,
  pointNameById,
  pollUntil,
  stockRowQty,
} from './admin-shipping-sql.mjs';
import { cents } from './admin-order-edit-sql.mjs';
import {
  cabinetShowsSnapshot,
  placeCourierOrder,
  placePickupOrder,
} from './admin-shipping-buyer.mjs';
import { renamePoint } from './admin-shipping-owner.mjs';
import { waitText } from './selectors.mjs';

/** Покупець: «Кур'єр» → `shipping_cost = 0`, `total = subtotal`, знімок `carrier`. */
export async function courierPart({ buyerPage, base, dbUrl, check, fx, st }) {
  const stock = await stockSnapshot(dbUrl, fx.slug);
  const o = await placeCourierOrder({
    page: buyerPage,
    base,
    dbUrl,
    stock,
    slug: fx.slug,
    m: st.courier,
  });
  st.orders.push(o.orderId);
  const row = await orderShipping(dbUrl, o.orderId);
  const snap = row?.shipping_data ?? {};
  check(
    "доставка: покупець оформив «Кур'єр» — shipping_cost = 0, total = subtotal, знімок pricing = carrier",
    cents(row?.shipping_cost) === 0 &&
      cents(row?.total) === cents(row?.subtotal) &&
      snap.pricing === 'carrier' &&
      snap.provider === 'core:address' &&
      snap.destination?.kind === 'address',
    `доставка ${row?.shipping_cost}, subtotal ${row?.subtotal}, total ${row?.total}; знімок ${JSON.stringify(snap)}`,
  );
  check(
    'чекаут: підсумок квоти carrier — «За тарифами перевізника», показане = записане',
    o.summaryCarrier && Math.abs(o.displayed - Number(row?.total)) < 0.01,
    `підпис у підсумку=${o.summaryCarrier}; підсумок ${o.displayed}, orders.total ${row?.total}`,
  );
}

/** Покупець: самовивіз на нову точку → знімок із назвою точки, резерв на ній. */
export async function pickupPart({ buyerPage, base, dbUrl, check, fx, st }) {
  const stock = await stockSnapshot(dbUrl, fx.slug);
  const qtyBefore = await stockRowQty(dbUrl, st.stockRowId);
  const o = await placePickupOrder({
    page: buyerPage,
    base,
    dbUrl,
    stock,
    slug: fx.slug,
    m: st.pickup,
    point: { id: st.point.id, name: fx.point.name },
  });
  st.orders.push(o.orderId);
  st.pickupOrderId = o.orderId;
  const row = await orderShipping(dbUrl, o.orderId);
  const dest = row?.shipping_data?.destination ?? {};
  const qtyAfter = await stockRowQty(dbUrl, st.stockRowId);
  check(
    'доставка: самовивіз на нову точку — shipping_data.destination.name = назва точки, доставка за тарифом, резерв на точці',
    dest.kind === 'pickup-point' &&
      dest.name === fx.point.name &&
      dest.pointId === st.point.id &&
      row?.pickup_point_id === st.point.id &&
      cents(row?.shipping_cost) === cents(fx.rate.baseCost) &&
      cents(row?.total) === cents(row?.subtotal) + cents(fx.rate.baseCost) &&
      qtyAfter === qtyBefore - 1,
    `destination ${JSON.stringify(dest)}; доставка ${row?.shipping_cost}, total ${row?.total}; залишок точки ${qtyBefore} → ${qtyAfter}`,
  );
  check(
    'order-success: показано назву точки зі знімка',
    o.successShowsPoint,
    fx.point.name,
  );
}

/** Власник перейменовує точку → картка адмінки й кабінет — назва зі знімка. */
export async function renamePart({
  page,
  buyerPage,
  base,
  dbUrl,
  check,
  fx,
  st,
}) {
  const saved = await renamePoint(
    page,
    base,
    st.point.id,
    fx.point.name,
    fx.point.renamed,
  );
  const name = await pollUntil(
    () => pointNameById(dbUrl, st.point.id),
    (v) => v === fx.point.renamed,
  );
  const row = await orderShipping(dbUrl, st.pickupOrderId);
  await page.goto(`${base}/admin/orders/${st.pickupOrderId}`, {
    waitUntil: 'networkidle',
  });
  const cardOld = await waitText(page, `${fx.point.name}, ${fx.point.address}`);
  const cardNew = await page.getByText(fx.point.renamed).count();
  const cab = await cabinetShowsSnapshot({
    page: buyerPage,
    base,
    orderId: st.pickupOrderId,
    oldName: fx.point.name,
    newName: fx.point.renamed,
  });
  check(
    'доставка: точку перейменовано — знімок у БД, картка адмінки й кабінет показують стару назву',
    saved &&
      name === fx.point.renamed &&
      row?.shipping_data?.destination?.name === fx.point.name &&
      cardOld &&
      cardNew === 0 &&
      cab.old &&
      cab.fresh === 0,
    `точка «${name}»; знімок «${row?.shipping_data?.destination?.name}»; картка: стара=${cardOld}, нова ${cardNew}; кабінет: стара=${cab.old}, нова ${cab.fresh}`,
  );
}
