// Визначення зони доставки — ЄДИНА чиста функція для чекауту (сервер), показу
// ціни в формі (клієнт) і перерахунку позицій замовлення в адмінці.

/** Куди їде замовлення — з цього, а не з міста, випливає зона. */
export type ZoneDestination =
  { kind: 'address' } | { kind: 'pickup-point'; zoneId: string | null };

/**
 * Зона доставки за пунктом призначення.
 *
 * 🔴 Місто покупця на зону НЕ впливає: адресна доставка завжди йде в основну
 * зону, а самовивіз — у зону обраної точки (`zone_id`; `NULL`, зокрема після
 * видалення зони за FK `SET NULL`, означає основну). Раніше зону вгадували за
 * вільним текстом міста — вона розходилась з тим, що бачив покупець, а
 * прихований `deliveryCity` самовивозу міг змінити ціну.
 *
 * `zones` — лише АКТИВНІ зони довідника. Точка з `zoneId`, якого серед них
 * немає (зону вимкнено), дає `null`: «зону не визначено», а не мовчазне
 * падіння на основну. Для режиму `rates` це відмова (`resolveShippingRate`).
 */
export function resolveShippingZone<
  Z extends { id: string; is_default: boolean },
>(zones: readonly Z[], destination: ZoneDestination): Z | null {
  if (destination.kind === 'pickup-point' && destination.zoneId !== null) {
    const zoneId = destination.zoneId;
    return zones.find((z) => z.id === zoneId) ?? null;
  }
  return zones.find((z) => z.is_default) ?? null;
}
