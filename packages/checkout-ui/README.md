# @simplycms/checkout-ui

React-компоненти оформлення замовлення SimplyCMS: контакти, отримувач,
доставка з розрахунком вартості, оплата й підсумок кошика. З них зібрана
канонічна сторінка `/checkout` у `@simplycms/storefront-routes`.

Пакет ядра [SimplyCMS](https://github.com/simplyCMS/simplyCMS) — відкритої
e-commerce CMS на TanStack Start + Supabase. Окремо ставити зазвичай не треба:
магазин створюється скаффолдером `pnpm create simplycms-store`, який приводить
усе ядро разом.

## Встановлення

```bash
pnpm add @simplycms/checkout-ui
```

Peer-залежності: `react` (18/19), `@tanstack/react-query`,
`@tanstack/react-router`, `lucide-react`.

## Що всередині

| Експорт | Що це |
|---------|-------|
| `CheckoutAuthBlock` | Блок для незалогіненого покупця: вкладки «гість / вхід / реєстрація», працює напряму з Supabase Auth |
| `CheckoutContactForm` | Контактні дані (`firstName`, `lastName`, `email`, `phone`) — контрольована форма `values` + `onChange` |
| `CheckoutRecipientForm` | Отримувач: чекбокс `hasDifferentRecipient`, а під ним — вибір і збереження отримувачів залогіненого покупця |
| `CheckoutDeliveryForm` | Доставка: методи, тарифи, точки видачі, збережені адреси; вартість віддає через `onShippingCostChange` |
| `CheckoutPaymentForm` | Спосіб оплати: `cash` при отриманні або `online` (поки вимкнено) |
| `CheckoutOrderSummary` | Підсумок: позиції, сума, доставка, коментар до замовлення, кнопка сабміту |
| `AddressCard`, `AddressSelectorPopup`, `AddressSaveDialog` | Збережені адреси: картка з вибором, попап із пошуком і сортуванням, діалог «оновити чи створити нову» |
| `RecipientCard`, `RecipientSelectorPopup`, `RecipientSaveDialog` | Те саме для збережених отримувачів |

Те саме доступне окремими subpath-ами (`exports` має `"./*"`):
`import { CheckoutOrderSummary } from '@simplycms/checkout-ui/CheckoutOrderSummary'`.

## Приклад

Форми — контрольовані ззовні; сторінка `/checkout` тримає стан у
`react-hook-form` і роздає його через `values` / `onChange`:

```tsx
import { CheckoutDeliveryForm, CheckoutOrderSummary } from '@simplycms/checkout-ui';

<CheckoutDeliveryForm
  values={form.watch()}
  onChange={(field, value) => form.setValue(field as keyof CheckoutFormData, value)}
  subtotal={totalPrice}
  onShippingCostChange={setShippingCost}
/>
<CheckoutOrderSummary
  items={items}
  totalPrice={totalPrice}
  shippingCost={shippingCost}
  notes={form.watch('notes') || ''}
  onNotesChange={(notes) => form.setValue('notes', notes)}
  isSubmitting={isSubmitting}
/>
```

Кошик у `items` — це `CartItem` із `@simplycms/react-query`.

## 🔴 Не всі компоненти presentational

`CheckoutAuthBlock`, `CheckoutDeliveryForm` і `CheckoutRecipientForm` самі
ходять у БД (`useSupabaseClient()` + `useQuery`/`useMutation`), а два останні
ще й беруть `useAuth` із legacy-фасаду `@simplycms/core`: вони працюють лише
всередині `QueryClientProvider` + `SupabaseProvider` (у магазині їх ставить
`CMSProvider`). Решта — чисті props. `values` скрізь типізовано як
`Record<string, string | boolean>` — помилку в імені поля компілятор не спіймає.

## Ліцензія

MIT
