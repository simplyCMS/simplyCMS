// Спільні цеглинки view-model-ів вітрини (контракт тем v3).
//
// Конвенція іменування: поля, що переносять дані товару/розділу/властивості
// «як є» (форма 1:1 із пропсами канонічних компонентів ядра), лишаються в
// snake_case — як решта контрактів `simplycms/contracts`; обчислені
// презентаційні скаляри (лічильники, відсотки, хлібні крихти) — camelCase.

import type { ThresholdHint } from '../objects/discount';

/** Ланка хлібних крихт. */
export interface BreadcrumbItem {
  label: string;
  /** Готовий href. Відсутній — поточна сторінка (рендериться не лінком). */
  href?: string;
  /** Мова підпису, коли він узятий з основної мови (fallback): view обгортає його `lang` (І37). */
  lang?: string | null;
}

/**
 * Фото товару чи модифікації мовою сторінки (М1, Task 17б). Файл — мовне перевизначення
 * (`product_image_translations.storage_key` мови сторінки), інакше спільний; `alt` —
 * переклад мови сторінки, інакше основної мови (тоді `alt_lang` = код основної), а коли
 * немає жодного — `''`: декоративне для скрінрідера, а НЕ назва файлу чи товару.
 */
export interface ProductImageViewModel {
  /** Готовий URL (референс сховища вже резолвлено). */
  url: string;
  alt: string;
  /**
   * Мова `alt`, коли його узято з основної мови (fallback), інакше відсутнє: view ставить
   * `lang` на сам `<img>` — атрибут застосовується до його `alt` (І37). Ознака з даних.
   */
  alt_lang?: string | null;
}

/**
 * Товар у списковому представленні (картка каталогу, слайд каруселі).
 *
 * Форма — 1:1 із пропсами канонічної `ProductCard`, щоб контейнер не
 * перекладав дані туди-сюди, а тема могла намалювати власну картку.
 */
export interface ProductCardViewModel {
  id: string;
  name: string;
  slug: string;
  /** Фото в порядку галереї; мініатюра картки — перше (див. `ProductImageViewModel`). */
  images: ProductImageViewModel[];
  short_description: string | null;
  /**
   * Мова назви / короткого опису, коли текст узято з основної мови (fallback), інакше
   * відсутнє: картка обгортає його `lang` (І37). Ознака з даних, не порівняння текстів.
   */
  name_lang?: string | null;
  short_description_lang?: string | null;
  /** Розділ потрібен для href картки; null — товар поза розділом. */
  section: { slug: string } | null;
  stock_status: string;
  price: number | null;
  old_price: number | null;
  /**
   * Порогові підказки (Е6в-12): «від 3 шт — 900 ₴/шт». Порожній список —
   * підказок немає або середовище цін ще не приїхало (SSR).
   */
  discount_hints: ThresholdHint[];
}

/**
 * View-model без slot-компонентів — форма фікстур і будь-яких серіалізовних
 * даних сторінки. Слоти підставляє споживач: канонічний container у проді,
 * conformance-kit у тестах.
 */
export type ViewModelData<TViewModel> = Omit<TViewModel, 'slots'>;
