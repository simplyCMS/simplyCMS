import type {
  ShippingMethod,
  ShippingRate,
  ShippingZone,
} from 'simplycms/contracts';
import type { JsonValue } from 'simplycms/schema/types';
import type { PickupPointRow } from './pickup-points';

/**
 * Довідникові рядки доставки у формі, яку МОЖНА віддати serverFn-ом.
 *
 * 🔴 Різниця з контрактом рівно одна: `config` звужений із
 * `Record<string, unknown>` до JSON. Валідатор серіалізації TanStack Start
 * відкидає `unknown` — і правильно робить: «щось, що не вміє їхати по
 * дроту» в payload-і вітрини не має бути. Обидва рядки лишаються
 * присвоюваними доменним типам, тож `resolveShippingRate` бере їх як є.
 */
export type ShippingMethodRow = Omit<ShippingMethod, 'config'> & {
  config: Record<string, JsonValue>;
};

/** Зона без опційного `rates`: тарифи їдуть окремим списком, не вкладеними. */
export type ShippingZoneRow = Omit<ShippingZone, 'rates'>;

export type ShippingRateRow = Omit<
  ShippingRate,
  'config' | 'method' | 'zone'
> & {
  config: Record<string, JsonValue>;
};

/**
 * Довідники доставки у формі, яку споживає форма чекауту.
 *
 * 🔴 Одна структура, а не чотири окремі виклики: способи, зони, тарифи й
 * точки видачі потрібні формі ОДНОЧАСНО, і зібрані з різних знімків БД вони
 * дали б неможливий стан (тариф на зону, якої в списку вже немає).
 */
export interface ShippingDirectory {
  methods: ShippingMethodRow[];
  zones: ShippingZoneRow[];
  rates: ShippingRateRow[];
  pickupPoints: PickupPointRow[];
}
