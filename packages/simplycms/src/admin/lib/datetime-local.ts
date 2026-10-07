/**
 * Поле `<input type="datetime-local">` ↔ `Date` у ЛОКАЛЬНОМУ часі браузера
 * власника (Е6в-22). На дроті й на сервері — абсолютний `Date`.
 *
 * 🔴 Без `toISOString().slice(0, 16)`: ISO — це UTC, тож легасі показував
 * київські «04:30» як «01:30» і при кожному збереженні зсував дату на пояс.
 */

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** `Date` → `YYYY-MM-DDTHH:mm` за локальним часом; `null`/невалідна → `''`. */
export function toDateTimeLocal(date: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) return '';
  return (
    `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-` +
    `${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Рядок поля → `Date` (локальний час браузера) або `null`, якщо поле порожнє
 * чи значення не є датою. Неоднозначну годину переходу на зимовий час
 * браузер трактує першим зсувом — відома межа (Е6в-22), тому незмінене поле
 * сюди не йде взагалі (див. `keepUnchangedDate`).
 */
export function fromDateTimeLocal(value: string): Date | null {
  const m = LOCAL.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi] = [m[1], m[2], m[3], m[4], m[5]].map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  const s = m[6] === undefined ? 0 : Number(m[6]);
  if (h > 23 || mi > 59 || s > 59) return null;
  const date = new Date(y, mo - 1, d, h, mi, s);
  // `new Date` мовчки переносить 31.02 на березень, а роки 0–99 — на 19xx.
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== mo - 1 ||
    date.getDate() !== d
  )
    return null;
  return date;
}

/**
 * Дата для запису (Е6в-22 ред.2): поле, якого власник не змінював, віддає
 * ВИХІДНИЙ `Date`, а не кругообіг через рядок. Інакше друга «03:30» ночі
 * переходу (01:30Z у Києві) збереглася б як перша (00:30Z), а секунди
 * обрізались би при кожному збереженні форми.
 */
export function keepUnchangedDate(
  value: string,
  original: Date | null,
): Date | null {
  return value === toDateTimeLocal(original)
    ? original
    : fromDateTimeLocal(value);
}
