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
| `createTranslator(locale, fallback)` | Транслятор-замикання: каталог мови → каталог `fallback` (основна мова магазину) → сам ключ |
| `languageOfConfigLocale(tag)` | Тимчасовий міст до М2 (знос `config.locale`): `'uk-UA'` → `'uk'`, `'EN'` → `'en'`. Не для кодів мов магазину (`pt-BR` — окрема мова) |
| `LANGUAGE_PACKS`, `getLanguagePack(code)` | Мовні пакети ядра (`uk`, `en`): каталог + (необов'язково) таблиця транслітерації адрес; мова без пакета → `null` |
| `I18nProvider`               | React-провайдер: мемоїзує транслятор по `locale` |
| `useT()`                     | Транслятор поточного рендера; кидає поза провайдером |
| `Locale`, `MessageKey`, `MessageParams`, `Catalog`, `LanguagePack`, `Translator` | Типи. `Locale` — відкритий рядок BCP 47; `MessageKey` виводиться з uk-каталогу — union замкнений |

## Приклад

```tsx
// host: src/routes/__root.tsx — провайдер над усіма групами роутів
import { I18nProvider, languageOfConfigLocale } from 'simplycms/i18n';
import config from '../../simplycms.config';

const locale = languageOfConfigLocale(config.locale);
<html lang={locale}>
  <body>
    <I18nProvider locale={locale}>{children}</I18nProvider>
  </body>
</html>;

// сторінка: packages/simplycms/src/storefront-routes/pages/Cart.tsx
import { useT } from 'simplycms/i18n';

const t = useT();
<h1>{t('cart.title')}</h1>;
<span>{t('cart.items', { count: items.length })}</span>;
```

## 🔴 Глобального `setLocale` (замінено на `createTranslator` для кожного запиту) немає навмисно

Модульного mutable-стану в пакеті нема — інакше два SSR-запити різними мовами
перетирали б локаль один одному. Резолв ключа — ланцюг «каталог локалі → каталог fallback-мови →
сам ключ»: пропущений переклад видно як `cart.title`, а не як мовчазний рядок
чужою мовою.

## Ліцензія

MIT
