/**
 * Ознаки витоку внутрішньої помилки у відповіді (Р23) — окремий модуль, щоб
 * регулярки мали юніт-контроль (`tests/live-smoke-leaks.test.ts`): `live:smoke`
 * ганяє їх по цілому HTML, де трапляються імена чанків і слово «select».
 */

/**
 * SQL Drizzle/pg: `select` + ПЕРЕЛІК колонок у лапках (або `*`) + `from <таблиця>`.
 * Голе `\bselect\b` ловило ім'я чанка `/assets/select-v9_YI4lp.js`; а варіант
 * `select \w+\.\w+ … from` — звичайну мову («Select file.ext from the folder»).
 * Drizzle завжди лапкує ідентифікатори, тож ознакою служить `*` або `"…"`
 * одразу після `select`; `[^<>]` не дає збігу перетнути теги HTML
 * (`<select name=a>…</select> from here`).
 */
export const SQL_SELECT =
  /\bselect\s+(?:\*|"[^"]+")[^<>]{0,500}?\bfrom\s+"?\w+/i;

/** Фрагменти, яких у відповіді бути НЕ може (SQL, параметри, адреса БД, дефолт TanStack). */
export const LEAKS = [
  /Failed query/,
  SQL_SELECT,
  /\bparams\b/i,
  /invalid byte sequence/,
  /ECONNREFUSED/,
  /Something went wrong/,
  /Show Error/,
];

/** Що з `LEAKS` і переданих адрес знайшлося в тексті. */
export const leaked = (text, addresses) => [
  ...LEAKS.filter((re) => re.test(text)).map(String),
  ...addresses.filter((a) => text.includes(a)),
];
