# Memory: features/shipping-management

Updated: now

## Статус реалізації

✅ Фаза 1: БД та структура - завершено
✅ Фаза 2: Адмін служб/зон - завершено  
✅ Фаза 3: Довідник локацій - завершено
✅ Фаза 4: Точки самовивозу - завершено
✅ Фаза 5: Інтеграція Checkout - завершено
✅ Фаза 6: Хуки для плагінів - завершено

## Огляд

Реалізовано базову систему управління доставкою в ядрі CMS. Система підтримує три типи служб доставки та розширюється через плагіни.

## Типи служб доставки

1. **Системні (`system`)**: вбудовані - Самовивіз (`pickup`), Кур'єр (`courier`)
2. **Ручні (`manual`)**: створені адміністратором з власною назвою та тарифами
3. **Плагінні (`plugin`)**: розширення від плагінів (Нова Пошта, Укрпошта тощо)

## Структура БД

- `shipping_methods` - служби доставки (code, name, type, plugin_name, config)
- `shipping_zones` - географічні зони (is_default для fallback)
- `shipping_zone_locations` - прив'язка локацій до зон
- `shipping_rates` - тарифи (flat, weight, order_total, free_from, plugin)
- `pickup_points` - точки самовивозу
- `locations` - ієрархічний довідник локацій (країна > область > місто > район)
- `orders` - розширено полями shipping_method_id, shipping_cost, shipping_data

## Типи розрахунку тарифів

- `flat` - фіксована ціна
- `weight` - базова + за кг
- `order_total` - відсоток від суми
- `free_from` - безкоштовно від певної суми
- `plugin` - розрахунок через хук плагіна

## Хуки для плагінів доставки

- `checkout.shipping.methods` - додавання методів
- `checkout.shipping.rates` - розрахунок тарифу плагіном
- `checkout.shipping.form` - додаткові поля форми
- `checkout.shipping.validate` - валідація даних
- `order.shipping.process` - обробка після створення замовлення
- `admin.shipping.method.settings` - налаштування методу в адмінці

## Адмін-панель

Новий розділ "Доставка" з підрозділами:
- `/admin/shipping/methods` - служби доставки
- `/admin/shipping/zones` - зони та тарифи
- `/admin/shipping/pickup-points` - точки самовивозу
- `/admin/shipping/locations` - довідник локацій

## Бізнес-логіка

- `src/lib/shipping/types.ts` - типи
- `src/lib/shipping/calculateRate.ts` - розрахунок вартості
- `src/lib/shipping/findZone.ts` - визначення зони за локацією

## Наступні кроки

- Фаза 5: Інтеграція в Checkout (оновлення форми, збереження shipping_cost)
- Фаза 6: PluginSlot в checkout для плагінів
- Плагін Нова Пошта (окремий план)
