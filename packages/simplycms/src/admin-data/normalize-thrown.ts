/**
 * UPSTREAM:TSDB-5 — docs/architecture/upstream-workarounds.md.
 *
 * `@tanstack/db` `Transaction.commit()` (transactions.ts) на catch робить
 * `error instanceof Error ? error : new Error(String(error))` — для
 * ПЛОСКОГО обʼєкта (не `Error`) це ЗНИЩУЄ всі властивості: `message`
 * стає `"[object Object]"`, `name` — родовий `"Error"`, власних ключів
 * нуль (перевірено прогоном на @tanstack/db 0.8.6). `adminErrorKey`
 * (`admin/lib/admin-error.ts`) читає `name`/`kind`/`constraint` — якщо цей
 * шлях спрацює, дані вже втрачено ДО адмінки, `.cause`-розгортання там
 * не допоможе (`.cause` теж не виставляється).
 *
 * Persistence-хендлери (`handlers.ts`) ловлять ВСЕ, що кинув serverFn, і
 * гарантують `instanceof Error` (зі збереженими власними полями) ДО того,
 * як воно потрапить у транзакцію TanStack DB — так `commit()`'s гілка
 * `instanceof Error` завжди `true`, і властивості (включно з
 * `AdminConflictError`'s `name`/`kind`/`constraint`) виживають.
 */
export function normalizeThrown(error: unknown): Error {
  if (error instanceof Error) return error;
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error);
  const err = new Error(message);
  if (error && typeof error === 'object') Object.assign(err, error);
  return err;
}
