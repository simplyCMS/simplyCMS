// Єдиний генератор slug для адрес і токенів (І22): реєстри `url_paths` та
// `slug_tokens` кличуть цю функцію, окремого slugify для токенів немає.

/** Формат slug: латиниця в нижньому регістрі й цифри, сегменти через один дефіс. */
export const SLUG_FORMAT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Усе, що `slugify` бере від мовного пакета: таблицю транслітерації. Структурний
 * тип, а не імпорт `LanguagePack` — domain (T1) не може залежати від `i18n` (T2).
 */
export interface LanguagePackSlugify {
  readonly slugify?: (text: string) => string;
}

/** Літери без розкладання в NFKD: мала мапа замість бібліотеки. */
const LATIN_FOLD: Readonly<Record<string, string>> = {
  ł: 'l',
  ø: 'o',
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  đ: 'd',
  þ: 'th',
};

/** Апострофи зникають (`don't` → `dont`), а не розбивають слово дефісом. */
const APOSTROPHES = /['’ʼ‘`]/g;

/**
 * Slug із тексту або `null`, коли письмо без таблиці не передати латиницею.
 *
 * Порядок: NFC → таблиця мови (якщо є) → нижній регістр → NFKD без діакритики
 * й мала мапа → решта не-алфавітно-цифрового стає роздільником `-`. Якщо після
 * цього лишилась літера чи цифра поза ASCII (`東京`, кирилиця без таблиці),
 * відповідь `null`: викликач вирішує, що робити (запитати адресу вручну), а
 * не отримує мотлох на кшталт порожнього або частково втраченого slug.
 * Не-ASCII пунктуація (`—`, `«»`) — лише роздільник.
 */
export function slugify(
  text: string,
  pack: LanguagePackSlugify | null,
): string | null {
  const prepared = text.normalize('NFC');
  const transliterated = pack?.slugify ? pack.slugify(prepared) : prepared;
  const folded = transliterated
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/[łøßæœđþ]/g, (ch) => LATIN_FOLD[ch]!)
    .replace(APOSTROPHES, '');
  if (/[^\x00-\x7f]/.test(folded.replace(/[^\p{L}\p{N}]/gu, ''))) return null;
  const slug = folded.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug === '' ? null : slug;
}
