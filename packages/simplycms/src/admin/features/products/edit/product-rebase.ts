import type { UseFormReturn } from 'react-hook-form';
import { emptyTexts } from './product-aggregate';
import { same } from './product-diff';
import { TEXT_FIELDS, type ProductFormValues } from './product-form-schema';

const SCALARS = [
  'sectionId',
  'isActive',
  'isFeatured',
  'hasModifications',
  'sku',
  'stockStatus',
  'path',
] as const;
const COLLECTIONS = ['modifications', 'propertyValues', 'images'] as const;

type Item = { readonly id: string };
const ids = (xs: readonly Item[]) => xs.map((x) => x.id);

/**
 * Колекція по елементах. ОДНЕ правило для обох гілок порядку: елемент, який користувач
 * змінив чи додав ПІСЛЯ відправки, лишається його — навіть якщо інший редактор його
 * паралельно видалив (правка не губиться мовчки, форма dirty; конфлікт із чужим
 * видаленням проявить наступне збереження через версію агрегата, 412). Елемент, якого
 * користувач не чіпав, береться з БД: змінений — свіжим, видалений — зникає.
 * Порядок — з БД, якщо після відправки склад і порядок не мінялись (власні правки,
 * яких у БД уже немає, — у кінці); інакше — користувача, а додане паралельно — в кінці.
 */
function mergeById<T extends Item>(fresh: T[], sent: T[], now: T[]): T[] {
  const sentById = new Map(sent.map((x) => [x.id, x]));
  const freshById = new Map(fresh.map((x) => [x.id, x]));
  const nowById = new Map(now.map((x) => [x.id, x]));
  const touched = (x: T) => !same(x, sentById.get(x.id));
  /** Елемент користувача після перечитування: правка — його, інакше стан БД (або нічого). */
  const resolve = (x: T): T[] => {
    if (touched(x)) return [x];
    const db = freshById.get(x.id);
    return db ? [db] : [];
  };
  if (same(ids(now), ids(sent))) {
    const base = fresh.map((x) => {
      const mine = nowById.get(x.id);
      return mine ? resolve(mine)[0]! : x;
    });
    const orphans = now.filter((x) => !freshById.has(x.id) && touched(x));
    return [...base, ...orphans];
  }
  const added = fresh.filter((x) => !sentById.has(x.id) && !nowById.has(x.id));
  return [...now.flatMap(resolve), ...added];
}

/**
 * Свіжий знімок БД + те, що користувач змінив ПІСЛЯ відправки запиту: поле,
 * що відрізняється між відправленим (`sent`) і поточним (`now`), лишається
 * поточним, решту бере БД. Тексти — по полях, колекції — по елементах (`mergeById`).
 */
export function rebase(
  fresh: ProductFormValues,
  sent: ProductFormValues,
  now: ProductFormValues,
): ProductFormValues {
  const out: ProductFormValues = structuredClone(fresh);
  for (const [locale, row] of Object.entries(now.texts)) {
    for (const f of TEXT_FIELDS)
      if (row[f] !== (sent.texts[locale]?.[f] ?? '')) {
        out.texts[locale] ??= emptyTexts();
        out.texts[locale][f] = row[f];
      }
  }
  for (const k of SCALARS)
    if (now[k] !== sent[k]) Object.assign(out, { [k]: now[k] });
  out.modifications = mergeById(
    out.modifications,
    sent.modifications,
    now.modifications,
  );
  out.propertyValues = mergeById(
    out.propertyValues,
    sent.propertyValues,
    now.propertyValues,
  );
  out.images = mergeById(out.images, sent.images, now.images);
  return out;
}

/**
 * Перечитування після власного збереження: форма стає знімком БД, а введене ПІСЛЯ
 * відправки накладається поверх як ЗМІНА (`shouldDirty`) — форма лишається dirty,
 * як `saveStock` не затирає незбережений статус (рішення власника, Task 13).
 * Голий `reset(rebase(...))` зробив би введене «збереженим» значенням за замовчуванням.
 */
export function resetAfterSave(
  form: UseFormReturn<ProductFormValues>,
  fresh: ProductFormValues,
  sent: ProductFormValues,
): void {
  const next = rebase(fresh, sent, form.getValues());
  form.reset(fresh);
  for (const k of ['texts', ...SCALARS, ...COLLECTIONS] as const)
    if (!same(next[k], fresh[k]))
      form.setValue(k, next[k], { shouldDirty: true });
}
