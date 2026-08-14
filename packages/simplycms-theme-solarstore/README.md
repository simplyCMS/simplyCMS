# @simplycms/theme-solarstore

Референс-**тема** SimplyCMS (контракт v2) — синя палітра для магазину
альтернативної енергетики. Водночас acceptance-фікстура механізмів Фази 4:
на ній перевіряються обидва шляхи установки теми зі спеки §17.4.

| Поверхня | Тут |
|----------|-----|
| Контракт | `ThemeModule` (`src/index.ts`), default-експорт |
| Паспорт | `src/manifest.ts` — `name`/`displayName`/`version`/`engines` |
| Токени | `src/tokens.ts` — палітра розкладається в CSS-змінні (`applyTokens`) |
| Компоненти | `src/components/` — Header, Footer, HeroBanner, HomeSections |
| i18n | `src/messages.ts`, ключі `theme.*`, uk/en (читає `useThemeT`) |

Сторінок і лейаутів тема не несе: канонічні сторінки живуть у
`@simplycms/storefront-routes`, каркаси беруть із теми лише Header/Footer.

## Встановлення в магазин

Шлях npm-пакета — тема лишається залежністю й оновлюється разом із ядром:

```bash
pnpm simplycms add @simplycms/theme-solarstore --theme
pnpm build
```

Шлях copy-in — сирці копіюються в `themes/<key>/` магазину, і далі тема
розвивається як власна (пакет після копії видаляється):

```bash
pnpm simplycms add @simplycms/theme-solarstore --theme --copy
pnpm build
```

Після збірки тему треба **активувати** в адмінці — `/admin/themes`: активна
тема зберігається в таблиці `themes` (`is_active`), а не в конфізі.

## Залежності

Референс-тема ядра тримає `@simplycms/*` у `dependencies` — вона їде тим
самим реліз-потягом, що й ядро, тож версія завжди одна.

🔴 Для **сторонньої** теми конвенція інша: `@simplycms/*` мають бути
`peerDependencies` (інакше в магазині зʼявиться друга копія React-контекстів
на кшталт `SupabaseProvider`), а сумісність із ядром оголошується через
`engines.simplycms`. Деталі й чекліст автора — `docs/architecture/themes.md`.
