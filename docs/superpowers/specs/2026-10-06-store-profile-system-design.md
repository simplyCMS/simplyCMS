# Хвиля Е6 «система»: профіль магазину, налаштування, теми й плагіни — дизайн

> **Статус:** затверджено власником 2026-10-06 (брейншторм). Виконується одним етапом
> **К3-Е6б** (рішення власника: без поділу на два етапи).
>
> **Мета:** сім легасі-файлів адмінки (`pages/{Settings,Themes,ThemeSettings,Plugins,PluginSettings}.tsx`,
> `hooks/{usePluginToggle,useThemeActivate}.ts`) переходять на серверний шар, а власник пілотного
> магазину отримує в адмінці «Профіль магазину»: назву, SEO, контакти, логотип і соцмережі, які
> вітрина показує без перезбірки.

## Факти, з яких виходить дизайн (розвідка 2026-10-06, `main` a8fb6c76)

- `Settings.tsx` редагує рівно одне: `system_settings[stock_management].value.decrease_on_order`.
  Читач — `inventory/order-stock.ts:10-20` (`loadStockManagement`), на кожне оформлення й зміну
  позиції. Інших читачів `system_settings` у коді немає; ключ `active_theme` (сід) мертвий.
- **Назва магазину зашита літералом** у `head` роутів вітрини: `'… — SimplyCMS Store'` у
  `routes/storefront/**` (кошик, каталог, розділ, товар, профіль, замовлення). Поля
  `seo.{siteName,defaultTitle,titleTemplate,defaultDescription}` із `simplycms.config.ts`
  проєктуються в `ConfigProvider` (`template/src/engine.shared.ts`), але вітрина їх не читає.
  Бренд і копірайт футера — тексти теми (`theme.brand`, `theme.footer.copyright`). Контактів
  магазину немає ніде.
- Теми й плагіни вшиваються в збірку (`simplycms.config.ts`). Адмінка лише вибирає активну тему з
  вшитих і вмикає плагіни. Рядки `themes`/`plugins` створюють `bootstrapThemes`/`bootstrapPlugins`;
  видалений з адмінки рядок плагіна вони відновлюють.
- Дефекти легасі: активація теми — два окремі `update` без транзакції (`useThemeActivate.ts:34-44`);
  форма налаштувань теми мовчки ігнорує типи `text`/`number` (`ThemeSettings.tsx:178-215`);
  `ThemeProvider` ініціалізує налаштування один раз (`ThemeContext.tsx:~84-95`), тож вітрина не
  бачить нових налаштувань без перезавантаження сторінки; `plugin_events` і
  `plugins.migrations_applied` ніхто не пише й не читає.
- `pluginConfigRead` (`plugin-sdk/server/index.ts:86`) публічний, а `plugins` має SELECT для
  `app_user`: конфіг плагіна читає аноном. FAQ-схема безпечна; секрети провайдерів — К5 (Ц4 спеки
  комерційних провайдерів: ключі лише зашифровано, не в браузер).

## Рішення власника

| № | Рішення |
|---|---|
| С-1 | Назва магазину, SEO, контакти, логотип і соцмережі редагуються в адмінці — у цій хвилі |
| С-2 | Мова й валюта лишаються в коді магазину (`simplycms.config.ts`) |
| С-3 | Кнопку «Видалити плагін» прибрано: вимкнути — перемикачем, прибрати зовсім — конфігом магазину й перезбіркою (як для тем) |
| С-4 | Хвиля — одним етапом |

## Частина A — профіль магазину

### Дані

`system_settings`, ключ `store_profile`, `value` jsonb під схемою `StoreProfile`:

```ts
type StoreProfile = {
  name: string;                 // обовʼязкове, ≤ 120
  homeTitle: string | null;     // <title> головної; null → name
  description: string | null;   // meta description за замовчуванням, ≤ 300
  contacts: {
    phone: string | null;
    email: string | null;       // формат email
    address: string | null;
    hours: string | null;       // вільний текст «Пн–Пт 9–18»
  };
  logo: string | null;          // референс порту сховища (не URL) — docs/architecture/storage.md
  socials: { network: SocialNetwork; url: string }[];  // ≤ 10, url — https
};
type SocialNetwork = 'instagram' | 'facebook' | 'telegram' | 'tiktok' | 'youtube' | 'x' | 'viber';
```

- Тип і перелік `SocialNetwork` — T0 (`simplycms/contracts`); Zod-схема запису — на сервері
  (`admin-server/impl`), читання з БД — ручний type-guard у T1 за прецедентом `parseShippingSnapshot`
  (T0/T1 без Zod, Е6а-19).
- Початкові значення дає сід (`0003_seed.sql`): `name = 'Мій магазин'`, решта `null`/порожньо;
  демо-сід — демо-профіль. Мертвий ключ `active_theme` зі сіду видаляється.
- Поля `seo.{siteName,defaultTitle,titleTemplate,defaultDescription}` видаляються з контракту
  `defineConfig` (`runtime/config.ts`), шаблону й `ConfigProvider.seo` (D5, одне джерело правди).
  `seo.siteUrl` → лишається (переїжджає на верхній рівень конфігу або лишається в `seo` — рішення
  плану), мова й валюта — без змін (С-2).

### Читання на вітрині

- Server-only лоадер `loadStoreProfile(db)` з TTL-кешем у процесі за прецедентом
  `storefront/loaders/theme-record.ts`; запис профілю в тому самому процесі скидає кеш.
  Межа: кеш на процес (як у теми) — магазин пілоту односерверний; багатоінстанс — поза хвилею.
- Кореневі лоадери вітрини (`_storefront.tsx`, `_protected.tsx`; і сторінки поза ними, що мають
  `head`, — `auth` тощо) отримують профіль разом із темою. Профіль кладеться в React-контекст;
  ядро експортує `useStoreProfile(): StoreProfile` (T4/T5 — тека визначається планом) для тем і
  сторінок ядра. Логотип віддається вже розвʼязаним у публічний URL порту сховища.
- **Заголовки:** `head` кожного роуту вітрини будує `«<сторінка> — <profile.name>»`; головна —
  `profile.homeTitle ?? profile.name`. Назви сторінок у `head` — через i18n (кириличні літерали в
  роутах ядра зникають). `meta description` за замовчуванням — `profile.description`, якщо роут не
  задає власного.
- **JSON-LD:** на головній — `Organization` (`name`, `url`, `logo`, `telephone`, `email`,
  `address`, `sameAs` = соцмережі).
- **Тема:** дефолтна тема бере бренд, логотип (якщо є — замість текстового бренду), контакти й
  соцмережі з `useStoreProfile()`; ключі `theme.brand` і назва магазину в `theme.footer.copyright`
  зникають з текстів теми. Контракт тем (`docs/architecture/themes.md`) і conformance-kit отримують
  профіль як дані ядра (фікстура профілю).

### Адмінка «Налаштування»

Одна сторінка `/admin/settings` з блоками: профіль і SEO; контакти; логотип (завантаження через
порт сховища, прецедент — зображення розділу Е4); соцмережі (список рядків «мережа + посилання»);
склад — перемикач «списувати залишок при оформленні». Серверні операції — під новою
authz-операцією `settings.manage: { admin: 'any' }`; колекції `admin-data` для одиничного рядка не
створюються (`contracts/admin-server-first.ts:11` — уже ухвалено), читання — query з ключем із
реєстру `contracts/entities`.

## Частина B — теми й плагіни

- **Активація теми** — одна серверна операція в одній транзакції (зняти активну → поставити
  цільову), що відмовляє, якщо цільової теми немає серед вшитих у збірку, і сама скидає
  `invalidateThemeCache()`. HTTP-ендпоінт `/api/revalidate-theme` стає зайвим — рішення плану
  (знести, якщо інших споживачів немає).
- **Налаштування теми:** форма рендерить усі типи `ThemeSettingDefinition` (`boolean`, `color`,
  `select`, `text`, `number`); запис — серверна операція з обмеженням розміру `jsonb`, скиданням
  кешу; `ThemeProvider` підхоплює нові `initialThemeSettings` при наступному лоаді без
  перезавантаження сторінки.
- **Плагіни:** перемикач активності й налаштування — серверні операції під authz
  (`settings.manage` або окрема операція — рішення плану); запис налаштувань перевикористовує
  наявний `savePluginConfig` (`plugin-sdk/server/config-db.ts`), а не новий шлях. «Видалити» — знесено
  (С-3) разом з `uninstallPlugin`. Публічність `plugins.config` фіксується в
  `docs/architecture/plugins.md` як контракт v1: секрети плагіна — лише після К5.
- **Прибирання (D5):** `plugin_events`, `plugins.migrations_applied`, ключ `active_theme`;
  `activatePlugin`/`deactivatePlugin` у `simplycms/plugins`, що тягнуть supabase-js, — замінюються
  серверним шляхом.

## Що етап доводить

- `pnpm live:smoke`: власник змінює назву, телефон, логотип і соцмережу → вітрина (новий
  запит) показує назву в `<title>` і бренді, телефон у футері, логотип, `sameAs` у JSON-LD
  головної; вимикає «списувати залишок» → оформлення не змінює залишок; активує іншу вшиту тему
  (якщо в демо їх кілька) або змінює налаштування теми → вітрина бачить зміну без перезапуску.
- `pnpm test:schema` — сід/гранти; юніти схеми профілю й type-guard читання.
- Лічильник `useSupabaseClient` у `src/admin/**`: 24 → **17**.

## Поза хвилею

Багатоінстансна інвалідація кешів; мульти-мова/мульти-валюта; листи (читатимуть той самий профіль
у треку «Готовність пілоту»); секрети плагінів (К5).
