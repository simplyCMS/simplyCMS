/**
 * Провайдери доставки й режими ціни — контракт між даними й кодом (Е6а-7).
 *
 * T0: лише типи й прості константи, нуль залежностей. Провайдер — запис
 * внутрішнього реєстру ядра («куди везти»); режим ціни — вибір власника
 * («скільки коштує»). Клієнту (форма способу, чекаут) потрібен лише цей
 * опис; серверна поведінка (перевірка пункту, знімок) живе в `commerce`.
 */
export const SHIPPING_PROVIDER = {
  address: 'core:address',
  pickup: 'core:pickup',
} as const;

/** Ідентифікатор вбудованого провайдера доставки. */
export type ShippingProviderId =
  (typeof SHIPPING_PROVIDER)[keyof typeof SHIPPING_PROVIDER];

/** Режими ціни: тарифи способу, квота провайдера, оплата за тарифами перевізника. */
export const SHIPPING_PRICINGS = ['rates', 'provider', 'carrier'] as const;
export type ShippingPricing = (typeof SHIPPING_PRICINGS)[number];

/** Опис провайдера для клієнта: куди везти і чи вміє він рахувати ціну. */
export interface ShippingProviderInfo {
  destination: 'address' | 'pickup-point';
  supportsQuote: boolean;
}

export const SHIPPING_PROVIDERS: Record<
  ShippingProviderId,
  ShippingProviderInfo
> = {
  [SHIPPING_PROVIDER.address]: { destination: 'address', supportsQuote: false },
  [SHIPPING_PROVIDER.pickup]: {
    destination: 'pickup-point',
    supportsQuote: false,
  },
};

/** Звужує рядок із БД чи форми до відомого провайдера. */
export function isShippingProviderId(x: string): x is ShippingProviderId {
  return Object.hasOwn(SHIPPING_PROVIDERS, x);
}

/**
 * Пункт видачі в знімку — однаковий на читанні й записі. `type`, а не
 * `interface`: знімок пишеться в `jsonb`, а інтерфейс не має індекс-сигнатури
 * й не присвоюється `JsonValue`.
 */
export type PickupPointDestination = {
  kind: 'pickup-point';
  pointId: string;
  name: string;
  address: string;
  city: string;
};

/**
 * Куди їде замовлення, як його ЧИТАЮТЬ. Знеособлення (Е6г-10) лишає `kind`, а
 * `city`/`address` адресної доставки обнуляє, тож на читанні `city` може бути
 * `null`. Пункт видачі знеособлення не змінює.
 */
export type ShippingDestination =
  | { kind: 'address'; city: string | null; address: string | null }
  | PickupPointDestination;

/**
 * Знімок доставки в `orders.shipping_data` (Е6а-8): замовлення читається
 * після перейменування чи видалення точки або способу.
 */
export interface ShippingSnapshot {
  methodName: string;
  provider: ShippingProviderId;
  pricing: ShippingPricing;
  destination: ShippingDestination;
}

/** Адресна доставка на ЗАПИСІ: місто обовʼязкове (Е6г-10, умова архітектора). */
export type NewShippingDestination =
  | { kind: 'address'; city: string; address: string | null }
  | PickupPointDestination;

/**
 * Знімок, який будує чекаут. Окремий від читального типу: `city: null`
 * допускає лише читальна сторона, а запис не сміє тихо пропустити живе
 * замовлення без міста.
 */
export type NewShippingSnapshot = Omit<ShippingSnapshot, 'destination'> & {
  destination: NewShippingDestination;
};
