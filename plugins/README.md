# plugins/

Локальні плагіни магазину (аліас `@plugins/*` у tsconfig/vite). Це найшвидший
dev-loop: тека підхоплюється без build-кроку і workspace-лінків — правки
видно після рестарту `pnpm dev`.

```bash
pnpm simplycms create plugin <name>   # скаффолд сюди + запис у simplycms.config.ts
```

Кожен плагін — `definePlugin` з `simplycms/plugin-sdk` (слоти, власні
таблиці `plg_<name>_*`, сторінки адмінки, Zod-настройки, каталог перекладів
з ключами `plugin.<name>.*`). Плагін НЕ імпортує Supabase-шар напряму —
лише порти SDK; це стереже dependency-lint.

Референс тут — `hello-world` (мінімальний приклад: слот + i18n); повний
контур (таблиця з міграцією в пакеті, `/admin/faq`, settings) —
npm-пакет [`@simplycms/plugin-faq`](../packages/simplycms-plugin-faq/).

Механізм цілком (контракт, рантайм, межа довіри, конвеєр міграцій,
верифікація) — [`docs/architecture/plugins.md`](../docs/architecture/plugins.md);
вимоги — спека платформи §7–§9, §12.
