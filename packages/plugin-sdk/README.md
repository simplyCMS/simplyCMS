# @simplycms/plugin-sdk

Plugin SDK для SimplyCMS: **єдина поверхня, яку дозволено імпортувати
плагіну** (межа довіри, спека платформи §7). Плагін не отримує
`SupabaseClient` і не імпортує `@simplycms/supabase` — лише порти звідси.

```ts
import { definePlugin } from '@simplycms/plugin-sdk';
import { z } from 'zod';
import { messages } from './messages';
import { FaqSlot } from './FaqSlot';

export default definePlugin({
  name: 'faq',
  displayName: 'FAQ',
  version: '0.1.0',
  engines: { simplycms: '>=0.3.0' },
  settings: z.object({ maxVisible: z.number().int().min(1).default(5) }),
  slots: { 'product.detail.after': FaqSlot },
  messages,
  adminRoutes: './routes',
  migrations: ['20260814000000_plg_faq_items.sql'],
});
```

## API

- `definePlugin(definition)` — декларативний контракт; повертає модуль,
  сумісний із `bootstrapPlugins` (`register`/`unregister` згенеровані).
- `validatePluginModule(value)` — pure-валідатор: помилки → модуль
  пропускається, попередження (зокрема несумісний `engines.simplycms`
  на 0.x) — у журнал.
- `usePluginT(messages)` — транслятор каталогу плагіна: fallback
  `locale → uk → key`, ключі з префіксом `plugin.<name>.`.
- `usePluginTable<Row>(table)` — CRUD-порт до ВЛАСНИХ таблиць плагіна
  (`plg_<name>_*`); чужі таблиці недосяжні за іменем.

## Межі v1

Ядро НЕ емить бізнес-подій (`order.created` тощо) — робочі точки
розширення сьогодні лише слоти (`PluginSlot`). `adminRoutes` і
`migrations` — декларації для CLI (`simplycms add` / `db:diff`), рантайм
їх не інтерпретує. Events/storage-фасади — наступні фази.

Референс-плагіни: мінімальний — `plugins/hello-world` у монорепо,
повний (таблиця + adminRoutes + settings + i18n) — `@simplycms/plugin-faq`.
