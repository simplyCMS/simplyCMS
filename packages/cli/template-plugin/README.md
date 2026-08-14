# simplycms-plugin-__PLUGIN_NAME__

Плагін SimplyCMS, скаффолджений `simplycms create plugin`.

Живе в теці `plugins/__PLUGIN_NAME__` магазину — аліас `@plugins/*` уже
налаштований, окремий build не потрібен: правки видно після перезапуску
`pnpm dev` (реєстрація плагінів — build-time).

## Що далі

- **Слоти/хуки** — додай у `definePlugin({ slots, hooks })` (`index.ts`).
- **Тексти** — лише через каталог `messages.ts` (`usePluginT`), ключі з
  префіксом `plugin.__PLUGIN_NAME__.`, en дзеркалить uk.
- **Налаштування** — Zod-схема в `definePlugin({ settings })`; форму рендерить
  адмінка, значення читай `usePluginConfig`.
- **Власні таблиці** — SQL-міграції в теці `migrations/` з іменем
  `<YYYYMMDDHHmmss>___PLUGIN_TABLE_PREFIX__<slug>.sql`; чіпати можна ЛИШЕ
  таблиці `__PLUGIN_TABLE_PREFIX__*` (межа довіри — `simplycms db:diff` це
  лінтить). Забрати в магазин: `pnpm simplycms db:diff --write` → ревʼю →
  `supabase db push`. Доступ із коду — `usePluginTable`.
- **Сторінки адмінки** — тека `routes/` із запеченими id
  `/admin/__PLUGIN_NAME__/…` + рядок `physical()` у `routes.ts` магазину
  (див. якір-коментар там); приклад — пакет `@simplycms/plugin-faq`.
