// Дані харнес-тестів редагування позицій (К3-Е5б Task 3) поверх демо-сіду й
// фікстур `./commerce`: тарифи доставки з копійками й відсотком від суми,
// гуртова ціна панелі (знижку на неї додає `percentDiscountStatements`) і
// ціни з копійками/під поріг мінімуму курʼєра.
import { COURIER_CODE } from './commerce';

/** Курʼєр із ФІКСОВАНИМ тарифом 70.10 — копійки доставки (Е5б-13). */
export const FIXED_CODE = 'e5b-fixed';
export const FIXED_COST = '70.10';
/** Курʼєр «відсоток від суми» = 100 % `subtotal` — межа `numeric(10,2)`. */
export const PERCENT_CODE = 'e5b-percent';
/** Гуртова ціна панелі 450 (до знижки −10 % гуртового типу ціни). */
export const WHOLESALE_PANEL_PRICE = 4000;
/** Інвертор 8 кВт — ціна з копійками; без обліку залишку в демо. */
export const INVERTER_PRICE = '1234.55';
/** Панель 600 — дешевша за мінімум курʼєра контуру (1000). */
export const BIFACIAL_PRICE = 500;

const courier = (code: string, type: string, cost: string): string[] => [
  `insert into public.shipping_methods (id, code, name, is_active, provider)
   values (gen_random_uuid(), '${code}', '${code}', true, 'core:address')`,
  `insert into public.shipping_rates
     (id, method_id, zone_id, name, calculation_type, base_cost, is_active, sort_order)
   select gen_random_uuid(), m.id, z.id, '${code}', '${type}', ${cost}, true, 0
     from public.shipping_methods m, public.shipping_zones z
    where m.code = '${code}' and z.is_default = true`,
];

const retailPrice = (slug: string, price: string | number): string =>
  `update public.product_prices set price = ${price}
    where modification_id is null
      and product_id = (select id from public.products where slug = '${slug}')
      and price_type_id = (select id from public.price_types where code = 'retail')`;

export const EDIT_FIXTURE_STATEMENTS: string[] = [
  ...courier(FIXED_CODE, 'flat', FIXED_COST),
  ...courier(PERCENT_CODE, 'order_total', '100'),
  `insert into public.product_prices (id, price_type_id, product_id, modification_id, price)
   select gen_random_uuid(), pt.id, p.id, null, ${WHOLESALE_PANEL_PRICE}
     from public.price_types pt, public.products p
    where pt.code = 'commerce-wholesale' and p.slug = 'sonyachna-panel-450w-mono'`,
  retailPrice('invertor-gibrydnyi-8kw', INVERTER_PRICE),
  retailPrice('sonyachna-panel-600w-bifacial', BIFACIAL_PRICE),
];

export const SLUGS = {
  panel: 'sonyachna-panel-450w-mono',
  panel550: 'sonyachna-panel-550w-mono',
  battery: 'akumulyator-lifepo4-200ah',
  station: 'stantsiya-nakopychennya-10kwh',
  inverter: 'invertor-gibrydnyi-8kw',
  bifacial: 'sonyachna-panel-600w-bifacial',
} as const;
export const METHODS = {
  pickup: 'pickup',
  courier: COURIER_CODE,
  fixed: FIXED_CODE,
  percent: PERCENT_CODE,
} as const;

export type EditIds = Record<
  keyof typeof SLUGS | keyof typeof METHODS | 'point' | 'wholesale' | 'user',
  string
>;
