import type { TextsForm } from './texts-form';

/**
 * Лише змінені поля лише змінених мов: незмінена вкладка у запит не потрапляє (І11).
 * Порожній рядок іде як `null` — це «очистити поле» на дроті.
 */
export function textsDiff<F extends string>(
  fields: readonly F[],
  before: TextsForm<F>,
  after: TextsForm<F>,
): Record<string, Partial<Record<F, string | null>>> {
  const out: Record<string, Partial<Record<F, string | null>>> = {};
  for (const [locale, cur] of Object.entries(after)) {
    const was = before[locale];
    const patch: Partial<Record<F, string | null>> = {};
    for (const f of fields)
      if (cur[f] !== (was?.[f] ?? '')) patch[f] = cur[f] === '' ? null : cur[f];
    if (Object.keys(patch).length > 0) out[locale] = patch;
  }
  return out;
}
