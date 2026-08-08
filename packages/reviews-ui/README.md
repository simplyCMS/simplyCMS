# @simplycms/reviews-ui

React-компоненти відгуків про товар для SimplyCMS: зведення рейтингу з
гістограмою оцінок, список відгуків, форма подання та зіркова шкала.
`ProductReviews` — контейнер: сам бере дані й мутації з `useProductReviews()`.

Пакет ядра [SimplyCMS](https://github.com/simplyCMS/simplyCMS) — відкритої
e-commerce CMS на TanStack Start + Supabase. Окремо ставити зазвичай не треба:
магазин створюється скаффолдером `pnpm create simplycms-store`, який приводить
усе ядро разом.

## Встановлення

```bash
pnpm add @simplycms/reviews-ui
```

Peer-залежності: `react` (18/19), `@tanstack/react-router`, `lucide-react`,
`date-fns`, `@tiptap/react` + `starter-kit`/`extension-link`/`extension-underline`.

## Що всередині

| Експорт | Що це |
|---------|-------|
| `ProductReviews` | Контейнер блока: `productId` → середній бал, розподіл 1–5, список, форма або лінк на `/auth` для гостя |
| `ReviewCard` | Картка відгуку: автор із `profile`, дата через `date-fns` з локаллю `uk`, лайтбокс фото, видалення власного |
| `ReviewForm` | Форма: обов'язкова оцінка, заголовок (до 200 символів), текст, опційні фото |
| `ReviewRichTextEditor` | Tiptap-редактор тексту (bold/italic/underline, списки, лінк, undo/redo) |
| `StarRating` | Шкала 5 зірок: `value`, `onChange`, `size` (`sm`/`md`/`lg`), `readonly`, половинки |

Те саме доступне окремими subpath-ами (`exports` має `"./*"`):
`import { StarRating } from '@simplycms/reviews-ui/StarRating'`.

## Приклад

Сторінка товару (`@simplycms/storefront-routes`, `pages/ProductDetail.tsx`)
монтує весь блок одним рядком:

```tsx
import { ProductReviews } from '@simplycms/reviews-ui';

<section id="section-reviews">
  <h2 className="text-xl font-semibold mb-4">Відгуки</h2>
  <ProductReviews productId={product.id} />
</section>;
```

## 🔴 `ReviewRichTextEditor` не підключається сам

Редактор і завантажувач фото приходять лише через render-props: без
`renderEditor` форма рендерить звичайний `<textarea>`, без `renderImageUpload`
блок фото не показується взагалі. Вмикається явно —
`renderEditor={(props) => <ReviewRichTextEditor {...props} />}`. Tiptap при
цьому лишається **обов'язковим** peer-ом (на відміну від `@simplycms/core`, де
він `optional`).

`ProductReviews` і `ReviewCard` кличуть `useAuth()` та `useProductReviews()` з
`@simplycms/core` — потрібен `<CMSProvider>` над деревом.

## Ліцензія

MIT
