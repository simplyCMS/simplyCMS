/**
 * Хвіст прибирання кроку доставки К3-Е6а (`./admin-shipping-cleanup.mjs`):
 * повернення дефолтної зони й видалення тестової (ідемпотентно — крок
 * setDefault міг упасти посередині) і фінальні асерти стану демо. Окремим
 * модулем за каноном 150 рядків.
 */
import { sql } from './sql.mjs';
import { orderShipping } from './admin-shipping-sql.mjs';
import { deleteRow, makeDefault, rowOf } from './admin-shipping-owner.mjs';

/** Чи лишились тестові записи кроку (способи за кодами, точка за назвою). */
export async function leftovers(url, codes, pointNames) {
  const [{ m }] = await sql(
    url,
    'select count(*)::int as m from public.shipping_methods where code = any($1)',
    [codes],
  );
  const [{ p }] = await sql(
    url,
    'select count(*)::int as p from public.pickup_points where name = any($1)',
    [pointNames],
  );
  return { methods: m, points: p };
}

/**
 * Стан демо: активні точки (воронка й `resolveStockPoint` стоять на рівно
 * одній, системній), способи самовивозу і дефолтні зони.
 */
async function demoShippingShape(url) {
  const points = await sql(
    url,
    'select is_system from public.pickup_points where is_active',
  );
  const [{ c }] = await sql(
    url,
    `select count(*)::int as c from public.shipping_methods
      where provider = 'core:pickup'`,
  );
  const zones = await sql(
    url,
    'select name, is_active from public.shipping_zones where is_default',
  );
  return { points, pickupMethods: c, zones };
}

/**
 * Дефолт — «Україні», тестової зони немає. Кожна дія — лише якщо потрібна
 * (SQL перед UI), тож на зеленому прогоні це no-op.
 */
export async function restoreZones({ page, base, dbUrl, check, fx }) {
  const label = 'прибирання: дефолт зони — «Україна», тестової зони немає';
  const facts = [];
  try {
    const read = () =>
      sql(dbUrl, 'select name, is_default from public.shipping_zones');
    let zones = await read();
    const def = zones.find((z) => z.is_default)?.name;
    const hasTest = zones.some((z) => z.name === fx.zone);
    if (def !== fx.rate.zone || hasTest)
      await page.goto(`${base}/admin/shipping/zones`, {
        waitUntil: 'networkidle',
      });
    if (def !== fx.rate.zone) {
      facts.push(`дефолт «${def}» → «${fx.rate.zone}»`);
      await makeDefault(page, fx.rate.zone);
    }
    if (hasTest) {
      facts.push(`видаляю «${fx.zone}»`);
      await deleteRow(page, fx.zone);
      await rowOf(page, fx.zone).waitFor({ state: 'detached' });
    }
    zones = await read();
    const ok =
      zones
        .filter((z) => z.is_default)
        .map((z) => z.name)
        .join() === fx.rate.zone && !zones.some((z) => z.name === fx.zone);
    check(label, ok, facts.length ? facts.join('; ') : 'нічого не треба');
  } catch (e) {
    check(label, false, `${facts.join('; ')}; виняток: ${e.message}`);
  }
}

/** Замовлення лишились зі знімком, демо — у вихідній формі доставки. */
export async function assertDemoShape({ dbUrl, check, fx, st }) {
  const rows = await Promise.all(
    st.orders.map((id) => orderShipping(dbUrl, id)),
  );
  check(
    'прибирання: замовлення лишились — pickup_point_id і shipping_method_id = NULL, знімок живий',
    rows.length === 2 &&
      rows.every(
        (r) => r && r.pickup_point_id === null && r.shipping_method_id === null,
      ) &&
      rows[1]?.shipping_data?.destination?.name === fx.point.name,
    `замовлень ${rows.length}: ` +
      rows
        .map((r) => {
          const d = r?.shipping_data;
          return `${d?.methodName} / ${d?.destination?.name ?? d?.destination?.city}`;
        })
        .join('; '),
  );
  const s = await demoShippingShape(dbUrl);
  check(
    'прибирання: демо знову має рівно одну активну точку (системну), один спосіб самовивозу і одну дефолтну зону — «Україна», активну',
    s.points.length === 1 &&
      s.points[0].is_system === true &&
      s.pickupMethods === 1 &&
      s.zones.length === 1 &&
      s.zones[0].name === fx.rate.zone &&
      s.zones[0].is_active === true,
    `активних точок ${s.points.length}, is_system ${s.points.map((p) => p.is_system).join(',')}; способів самовивозу ${s.pickupMethods}; дефолтні зони ${JSON.stringify(s.zones)}`,
  );
}
