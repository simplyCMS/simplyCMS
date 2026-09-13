// Медіа-референс і його резолв у URL — тір T1, без IO.
//
// 🔴 У БД лежить РЕФЕРЕНС, а не URL (рішення Е2-1): рядок каже, ЩО це за
// зображення, а не ЗВІДКИ його роздають. Інакше зміна драйвера сховища
// вимагала б переписати всі збережені рядки, а зовнішньо хостовані картинки
// й плейсхолдери сіду не мали б куди подітись.
//
// 🔴 Функція чиста й живе в T1 саме тому, що її кличуть з обох боків межі:
// серверні лоадери вітрини (побудова view-model-ів) і — у К4, коли зʼявиться
// `transform` — клієнтський порт. Модуль із `node:fs` цього не витримав би.

/** Референс на зображення: storage key АБО зовнішній/вбудований URL. */
export type MediaRef = string;

/** База URL роздачі драйвера `local-fs` (роут `/media/$`, Task 4). */
export const MEDIA_URL_BASE = '/media';

/**
 * MIME, які приймає завантаження. Живуть у T1, а НЕ в `simplycms/storage`,
 * бо потрібні обом бокам межі: сервер звіряє з ними магічні байти, клієнт
 * підставляє в атрибут `accept`. Без цього рядок `accept` дублювався б у
 * кожному компоненті завантаження — третя копія того самого правила.
 *
 * 🔴 SVG відсутній свідомо (рішення Е2-10): він несе скрипти.
 */
export const ACCEPTED_IMAGE_MIME = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
] as const;

/** Значення атрибута `accept` для `<input type="file">`. */
export const ACCEPT_ATTRIBUTE = ACCEPTED_IMAGE_MIME.join(',');

/**
 * Стеля розміру завантаження, байти.
 *
 * 🔴 Два різні значення — навмисно, НЕ розсинхрон: «вирівняти» їх означало б
 * або дозволити 10-мегабайтний аватар (він показується мініатюрою 96×96, тож
 * це чисті витрати диска й трафіку), або обрізати зображення товару до 5 МБ
 * (а там знімок із камери — норма). Різниця в призначенні, не в недогляді.
 *
 * 🔴 Обидві — тут, у T1, а не в компонентах: до Е2 ліміт стояв у ТРЬОХ
 * місцях (два компоненти + сервер), і клієнтські копії вже розійшлися між
 * собою. Сервер лишається джерелом правди — клієнтська перевірка існує лише
 * щоб не вантажити 50 МБ заради відмови.
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

// Форми, які вже Є адресою й не потребують бази. `blob:` — локальне прев’ю,
// яке браузер створює до завантаження; воно ніколи не доходить до БД, але
// проходить через ту саму функцію в рендері форми.
const ALREADY_ABSOLUTE = /^(?:https?:|data:|blob:|\/)/i;

/**
 * Референс → URL. `null` означає «зображення немає» — саме так, а не
 * порожній рядок: `<img src="">` перезавантажує поточну сторінку.
 */
export function resolveMediaUrl(
  ref: string | null | undefined,
  base: string = MEDIA_URL_BASE,
): string | null {
  if (ref === null || ref === undefined) return null;
  const trimmed = ref.trim();
  if (trimmed === '') return null;
  if (ALREADY_ABSOLUTE.test(trimmed)) return trimmed;
  return `${base.replace(/\/+$/, '')}/${trimmed}`;
}

/** Те саме для масиву; елементи, що дали `null`, викидаються. */
export function resolveMediaUrls(
  refs: readonly string[],
  base: string = MEDIA_URL_BASE,
): string[] {
  const out: string[] = [];
  for (const ref of refs) {
    const url = resolveMediaUrl(ref, base);
    if (url !== null) out.push(url);
  }
  return out;
}

/**
 * Колонки схеми, що несуть медіа-референс.
 *
 * 🔴 Реєстр існує заради ГЕЙТА, а не заради коду: нова медіа-колонка,
 * додана в схему без резолву на вітрині, показала б покупцеві голий
 * storage key замість картинки — і виявилось би це аж на живому магазині.
 * Тест `schema/__tests__/media-columns-coverage.test.ts` звіряє цей список
 * зі схемою; Task 6 доводить, що кожен запис резолвиться при читанні.
 */
export const MEDIA_COLUMNS = [
  { table: 'products', column: 'images' },
  { table: 'product_modifications', column: 'images' },
  { table: 'product_reviews', column: 'images' },
  { table: 'banners', column: 'image_url' },
  { table: 'banners', column: 'desktop_image_url' },
  { table: 'banners', column: 'mobile_image_url' },
  { table: 'sections', column: 'image_url' },
  { table: 'property_options', column: 'image_url' },
  { table: 'profiles', column: 'avatar_url' },
  // 🔴 Не було в первинному переліку плану — знайдено гейтом покриття
  // (`schema/__tests__/media-columns-coverage.test.ts`): колонка існує в
  // схемі, а в реєстрі її не було.
  { table: 'services', column: 'image_url' },
] as const satisfies readonly { table: string; column: string }[];
