import { z } from 'zod';

/** Search-параметри `/admin/orders`: фільтр статусу живе в URL (Е6г-5). */
export interface OrdersSearch {
  readonly status?: string;
}

const uuid = z.uuid();

/** Невалідний `status` (не uuid) мовчки відсікається: сторінка без фільтра. */
export function validateOrdersSearch(
  search: Record<string, unknown>,
): OrdersSearch {
  const parsed = uuid.safeParse(search.status);
  return { status: parsed.success ? parsed.data : undefined };
}
