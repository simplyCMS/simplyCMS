import type {
  ShippingMethod,
  ShippingRate,
  ShippingZone,
} from 'simplycms/contracts';
import type { JsonValue } from 'simplycms/schema/types';
import type { PickupPointRow } from './pickup-points';

/**
 * Публічний рядок способу доставки (довідник вітрини).
 *
 * 🔴 БЕЗ `config` (Е6а-13): довідник читає аноном, а `config` у К5 може нести
 * секрети провайдера. Вбудовані провайдери його не використовують; рушій
 * тарифів його теж не читає (`ShippingCalculationContext.method`).
 */
export type ShippingMethodRow = Omit<ShippingMethod, 'config'>;

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
