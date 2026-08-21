# @simplycms/plugin-faq

Референс-плагін SimplyCMS **повного контуру SDK**: демонструє все, що вміє
`simplycms/plugin-sdk`, і слугує acceptance-фікстурою механізмів Фази 3.

| Поверхня | Тут |
|----------|-----|
| Контракт | `definePlugin` (`src/index.ts`) |
| Таблиця | `plg_faq_items` — міграція в `migrations/`, накат: `simplycms db:diff --write` + ревʼю |
| Адмінка | `/admin/faq` (`routes/admin/faq/`) — CRUD через `usePluginTable`, без прямого Supabase |
| Слот | `product.detail.after` — FAQ до товару + загальні питання |
| Налаштування | Zod-схема `maxVisible`; форму рендерить адмінка, значення читає `usePluginConfig` |
| i18n | `src/messages.ts`, ключі `plugin.faq.*`, uk/en |

## Встановлення в магазин

```bash
pnpm simplycms add @simplycms/plugin-faq --plugin
pnpm simplycms db:diff --write   # міграція плагіна → supabase/migrations (ревʼю!)
supabase db push
pnpm build
```

Монтаж роутів адмінки — рядок `physical()` у `routes.ts` магазину
(див. якір-коментар там); мінімальний приклад плагіна без таблиць —
`plugins/hello-world` у монорепо.
