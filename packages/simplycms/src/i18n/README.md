# simplycms/i18n

Локалізація без глобального стану: транслятор створюється під конкретну локаль
(per-request / per-render), тож SSR кількох запитів різними мовами безпечний.
У комплекті каталоги `uk` (повний) і `en` (частковий).

Шар ядра [SimplyCMS](https://github.com/simplyCMS/simplyCMS) — відкритої
e-commerce CMS на TanStack Start + PostgreSQL. Окремим пакетом він більше не
постачається: усе ядро приходить одним npm-пакетом `simplycms`, а магазин
створюється скаффолдером `pnpm create simplycms-store`.

## Встановлення

```bash
pnpm add simplycms
```

Вхід цього шару — субшлях `simplycms/i18n`.

## Що всередині

Єдиний вхід — `simplycms/i18n` (subpath-експортів немає).

| Символ | Опис |
|--------|------|
| `createTranslator(locale, fallback)` | Транслятор-замикання над `UiLocale`: каталог мови → каталог `fallback` (основна мова магазину) → сам ключ |
| `lookupMessage(catalogs, key, params?)` | Єдиний ланцюг пошуку: перший каталог із ключем → підстановка `{name}`; ніде немає → сам ключ. Спільний для ядра, `useThemeT`, `usePluginT` |
| `resolveUiLocale(content, primary)` | Міст осі контенту до осі інтерфейсу: пакет мови → пакет базової мови → ті самі кроки для основної → помилка з переліком пакетів |
| `toUiLocale(value, parts?)`, `resolveAdminUiLocale(stored, primary)` | Точний код наявного пакета з частинами (типово `base`+`mail`) або `null`; мова адмінки: збережена з `admin` → основна з `admin` → `en` |
| `listLanguagePacks()`, `hasLanguagePack(code, parts?)`, `getUiPack(ui)`, `getContentTools(code)` | Мовні пакети ядра (`uk`, `en`; реєстр не експортується): `ui` = `base` + `mail` + необов'язкова `admin`, `content` — таблиця транслітерації адрес. Мову публікують лише з пакетом `base`+`mail` (`hasLanguagePack`, точний код або базова мова); `getContentTools` без пакета → `null` |
| `I18nProvider`               | React-провайдер `{ locale, fallback }` (обидві — `UiLocale`): мемоїзує транслятор по парі мов |
| `useT()`, `useUiLocale()`, `useUiLocalePair()` | Транслятор поточного рендера; мова інтерфейсу для форматування; пара мов для каталогів теми й плагіна. Кидають поза провайдером |
| `useFormatDate(style?)` | Форматувач дати за мовою інтерфейсу (`medium` / `short` / `datetime`); єдине місце, де вітрина й адмінка форматують дати |
| `UiLocalePair`, `MessageKey`, `MessageParams`, `Catalog`, `LanguagePack`, `Translator` | Типи. Тип `UiLocale` (код наявного пакета; бренд, не мова контенту) живе в `simplycms/contracts` — звідси його немає, конструктори `resolveUiLocale`/`toUiLocale` — тут; `MessageKey` виводиться з uk-каталогу — union замкнений |

## Приклад

```tsx
// host: src/routes/__root.tsx — провайдер над усіма групами роутів
// `locale` — мова контенту (для <html lang>), `ui` — мова інтерфейсу з моста resolveUiLocale
const { locale, ui } = Route.useLoaderData();
<html lang={locale}>
  <body>
    <I18nProvider locale={ui.locale} fallback={ui.fallback}>
      {children}
    </I18nProvider>
  </body>
</html>;

// сторінка: packages/simplycms/src/storefront-routes/pages/Cart.tsx
import { plural, useT } from 'simplycms/i18n';

const t = useT();
<h1>{t('cart.title')}</h1>;
<span>{t('cart.itemsTitle', { count: items.length })}</span>;
// множина: значення ключа — PluralForms, форму вибирає Intl.PluralRules мови інтерфейсу
<span>{plural(t, 'cart.items', items.length)}</span>;
```

## 🔴 Глобального `setLocale` (замінено на `createTranslator` для кожного запиту) немає навмисно

Модульного mutable-стану в пакеті нема — інакше два SSR-запити різними мовами
перетирали б локаль один одному. Резолв ключа — ланцюг «каталог локалі → каталог fallback-мови →
сам ключ»: пропущений переклад видно як `cart.title`, а не як мовчазний рядок
чужою мовою.

## Ліцензія

MIT
