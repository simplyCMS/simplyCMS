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
 * Сутності, до яких адмінка сміє привʼязати завантажений файл.
 *
 * 🔴 Живе в T1 з тієї самої причини, що `ACCEPTED_IMAGE_MIME`: список
 * потрібен ОБОМ бокам межі — сервер звіряє з ним `entity_type` перед
 * вставкою в `media` (довільне значення від клієнта зробило б облік
 * незведéним, а sweep орфанів К4 — сліпим), клієнт типізує ним пропс
 * `ImageUpload`. Друга копія списку розійшлася б на першій же новій
 * сутності, і розійшлася б МОВЧКИ: компонент приймав би тип, який сервер
 * відкидає.
 */
export const MEDIA_ENTITY_TYPES = [
  'product',
  'product_modification',
  'section',
  'banner',
  'property_option',
  'store_logo',
] as const;

export type MediaEntityType = (typeof MEDIA_ENTITY_TYPES)[number];

/**
 * Фото відгуку покупця (Е6д-5, КАНОН).
 *
 * 🔴 `'review'` свідомо НЕ в `MEDIA_ENTITY_TYPES`: той список — allowlist
 * адмінського `uploadMedia`, а сценарію «адмін вантажить фото відгуку» немає.
 * Пише їх лише подача відгуку (`submitReviewWithImages`), як `'avatar'` —
 * лише заміна аватара. Кількість і розмір КОЖНОГО файлу звіряються ДО
 * першого запису; сумарну стелю тіла запиту тримає `MAX_REQUEST_BODY_BYTES`
 * (К3-Е6д-2, `runtime/body-limit`).
 */
export const REVIEW_MEDIA_ENTITY = 'review';

/**
 * Власник файлу логотипа (К3-Е6д-3). Логотип один на магазин і не має рядка-
 * носія, тож `entity_id` фіксований: двофазне стирання (`eraseMediaRows`)
 * вимагає власника, а сервер сам підставляє цей uuid при upload `store_logo`,
 * не довіряючи клієнту.
 */
export const STORE_LOGO_OWNER_ID = '00000000-0000-4000-8000-00000000106f';

/**
 * Типи власника, чиї файли роздаються з `private, no-cache` (Е6д-21): їхня
 * видимість залежить від глядача (відгук на модерації видно лише автору й
 * адміну; аватар — персональні дані), тож спільний/CDN-кеш з `immutable`
 * зберіг би файл для того, кому його вже не можна показувати.
 */
export const PERSONAL_MEDIA_ENTITY_TYPES = [
  REVIEW_MEDIA_ENTITY,
  'avatar',
] as const;

export const MAX_REVIEW_IMAGES = 5;
export const MAX_REVIEW_IMAGE_BYTES = 5 * 1024 * 1024;

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

/**
 * Запас на multipart-обгортку (межі, заголовки частин, поля форми) понад
 * сумарний розмір файлів. 1 МБ з великим запасом: 5 файлів + кілька полів
 * займають одиниці КБ службових байтів.
 */
export const MULTIPART_OVERHEAD_BYTES = 1024 * 1024;

/**
 * Машинні коди відмови стелі тіла (тіло відповіді 413/411). Живуть у T1, бо
 * їх читає клієнт: serverFn-клієнт Start кидає `Error(тіло відповіді)` лише
 * коли відповідь має `content-type` — порожнє тіло віддало б неінформативну
 * invariant-помилку, з якої 413 не відрізнити від будь-якого збою.
 */
export const PAYLOAD_TOO_LARGE_CODE = 'request/payload-too-large';
export const LENGTH_REQUIRED_CODE = 'request/length-required';

/**
 * Стеля тіла будь-якого POST на server function (К3-Е6д-2). Виводиться з
 * найбільшого легітимного запиту — подачі відгуку з 5 фото — а не літералом,
 * тож зміна лімітів вище автоматично зсуває стелю. Не менша за одиночне
 * завантаження медіа й аватар (тест це стереже).
 */
export const MAX_REQUEST_BODY_BYTES = Math.max(
  MAX_REVIEW_IMAGES * MAX_REVIEW_IMAGE_BYTES + MULTIPART_OVERHEAD_BYTES,
  MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES,
  MAX_AVATAR_BYTES + MULTIPART_OVERHEAD_BYTES,
);

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
 * Значення медіа-колонки-масиву (`images`) → список референсів. Колонки —
 * nullable `jsonb` без CHECK форми, тож `NULL`, обʼєкт чи не-рядки можливі;
 * лишаються лише непорожні рядки. 🔴 Одне правило для адмінки, вітрини й
 * стирання: копії вже розходились (одна пропускала `''`).
 */
export function normalizeMediaRefs(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string' && v !== '')
    : [];
}

/**
 * Колонки схеми, що несуть медіа-референс.
 *
 * 🔴 Реєстр існує заради ГЕЙТА, а не заради коду: нова медіа-колонка,
 * додана в схему без резолву на вітрині, показала б покупцеві голий
 * storage key замість картинки — і виявилось би це аж на живому магазині.
 *
 * 🔴 Гейтів на реєстрі ДВА, і жоден із них не доводить «кожен запис
 * резолвиться при читанні» — та обіцянка стояла тут до 2026-09-13 без
 * покриття, і саме в цей розрив проїхав сирий `avatar_url` у
 * `loadReviewAuthors`:
 *   • `tests/media-columns-coverage.test.ts` — парність реєстру зі схемою
 *     (колонка є в схемі → мусить бути тут). Про читачів не знає нічого;
 *   • `tests/media-read-resolve.test.ts` — кожна ПРОЄКЦІЯ медіа-колонки в
 *     `storefront/loaders/**` названа резолвером (або внесена в `RAW_READS`
 *     із причиною). Поза його очима лишаються читання цілим рядком без
 *     проєкції і читачі поза лоадерами — зокрема `src/admin/**`.
 */
export const MEDIA_COLUMNS = [
  { table: 'products', column: 'images', entityType: 'product', kind: 'jsonb' },
  {
    table: 'product_modifications',
    column: 'images',
    entityType: 'product_modification',
    kind: 'jsonb',
  },
  // М1 (Task 12): фото товару — рядок на зображення; власник файлу завжди
  // товар (`entityType: 'product'`), і для зображення модифікації теж.
  {
    table: 'product_images',
    column: 'storage_key',
    entityType: 'product',
    kind: 'text',
  },
  // Мовний варіант файлу (перевизначення): таблиця без `id` — ідентифікатор
  // у `findMediaReferences` складається з вираження `idExpression`.
  {
    table: 'product_image_translations',
    column: 'storage_key',
    entityType: 'product',
    kind: 'text',
    idExpression: "image_id::text || ':' || locale",
  },
  {
    table: 'product_reviews',
    column: 'images',
    entityType: REVIEW_MEDIA_ENTITY,
    kind: 'jsonb',
  },
  { table: 'banners', column: 'image_url', entityType: 'banner', kind: 'text' },
  {
    table: 'banners',
    column: 'desktop_image_url',
    entityType: 'banner',
    kind: 'text',
  },
  {
    table: 'banners',
    column: 'mobile_image_url',
    entityType: 'banner',
    kind: 'text',
  },
  {
    table: 'sections',
    column: 'image_url',
    entityType: 'section',
    kind: 'text',
  },
  {
    table: 'property_options',
    column: 'image_url',
    entityType: 'property_option',
    kind: 'text',
  },
  {
    table: 'profiles',
    column: 'avatar_url',
    entityType: 'avatar',
    kind: 'text',
  },
] as const satisfies readonly {
  table: string;
  column: string;
  /** `media.entity_type` файлів, чий референс лежить у цій колонці (гейт sweep). */
  entityType: string;
  /** Тип колонки: `jsonb` — масив референсів, `text` — один. Звіряється з БД тестом парності. */
  kind: 'text' | 'jsonb';
  /**
   * SQL-вираз ідентифікатора рядка для таблиць без колонки `id` (складений PK).
   * Лише літерал із цього реєстру: у запит іде через `sql.raw`.
   */
  idExpression?: string;
}[];

/**
 * Гілка референсу поза `MEDIA_COLUMNS`: логотип лежить у
 * `system_settings.value->>'logo'`, а не в колонці (Е6д-22). `findMediaReferences`
 * перевіряє її окремо; гейт `media-sweep-coverage` рахує її поруч із колонками.
 */
export const LOGO_MEDIA_REFERENCE = {
  table: 'system_settings',
  column: 'value.logo',
  entityType: 'store_logo',
} as const;

/**
 * Мінімальний вік рядка `media`, з якого sweep сміє його стерти (Е6д-22):
 * молодший файл міг бути щойно завантажений і ще не привʼязаний формою.
 */
export const MEDIA_SWEEP_MIN_AGE_HOURS = 24;

/** Кандидатів у одному пакеті sweep (окрема коротка транзакція). */
export const MEDIA_SWEEP_BATCH = 100;

/** Верхня межа пакетів за один виклик sweep; решту добере наступний. */
export const MEDIA_SWEEP_MAX_BATCHES = 10;
