// Спільні цеглинки view-model-ів вітрини (контракт тем v3).
//
// Конвенція іменування: поля, що переносять дані товару/розділу/властивості
// «як є» (форма 1:1 із пропсами канонічних компонентів ядра), лишаються в
// snake_case — як решта контрактів `simplycms/contracts`; обчислені
// презентаційні скаляри (лічильники, відсотки, хлібні крихти) — camelCase.

/** Ланка хлібних крихт. */
export interface BreadcrumbItem {
  label: string;
  /** Готовий href. Відсутній — поточна сторінка (рендериться не лінком). */
  href?: string;
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
  images: string[];
  short_description: string | null;
  /** Розділ потрібен для href картки; null — товар поза розділом. */
  section: { slug: string } | null;
  stock_status: string | null;
  price: number | null;
  old_price: number | null;
}

/**
 * View-model без slot-компонентів — форма фікстур і будь-яких серіалізовних
 * даних сторінки. Слоти підставляє споживач: канонічний container у проді,
 * conformance-kit у тестах.
 */
export type ViewModelData<TViewModel> = Omit<TViewModel, 'slots'>;
