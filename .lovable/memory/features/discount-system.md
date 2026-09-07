# Memory: features/discount-system
Updated: now

## Архітектура
Модуль скидок з деревовидною структурою груп. Кожна група має оператор (and/or/not/min/max) для визначення логіки застосування дочірніх скидок.

## Таблиці
- `discount_groups` -- дерево груп (self-referencing parent_group_id), оператор логіки
- `discounts` -- окремі скидки в групі (percent/fixed_amount/fixed_price), прив'язка до price_type_id
- `discounts` -- окремі скидки в групі (percent/fixed_amount/fixed_price)
- `discount_targets` -- до чого застосовується (product/modification/section/all)
- `discount_conditions` -- умови (user_category, min_quantity, min_order_amount, user_logged_in)
- `order_items.base_price` + `order_items.discount_data` -- фіксація деталей знижки

## Ключові файли
- `src/lib/discountEngine.ts` -- чиста логіка обчислення (resolveDiscount)
- `src/pages/admin/Discounts.tsx` -- дерево груп та скидок
- `src/pages/admin/DiscountGroupEdit.tsx` -- CRUD групи
- `src/pages/admin/DiscountEdit.tsx` -- CRUD скидки з targets та conditions
- `src/pages/admin/PriceValidator.tsx` -- діагностика ціноутворення

## Енуми
- discount_type: 'percent' | 'fixed_amount' | 'fixed_price'
- discount_group_operator: 'and' | 'or' | 'not' | 'min' | 'max'
- discount_target_type: 'product' | 'modification' | 'section' | 'all'

## Фронтенд-інтеграція
- `src/hooks/useDiscountedPrice.ts` -- useDiscountGroups(), useDiscountContext(), applyDiscount()
- Каталог (Catalog.tsx) -- знижки застосовуються при формуванні списку товарів
- Картка товару (ProductDetail.tsx) -- знижки застосовуються до базової ціни
- Checkout -- base_price та discount_data фіксуються в order_items

## Plugin Hooks
- `discount.conditions.evaluate` -- при перевірці умов
- `discount.before_apply` -- перед застосуванням
- `discount.after_apply` -- після застосування
- `discount.types` -- реєстрація нових типів
- `admin.discount.form.fields` -- додаткові поля у формі

## TODO
- Промокоди як плагін (condition_type: 'promo_code')
