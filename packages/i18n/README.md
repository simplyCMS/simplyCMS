# @simplycms/i18n

Локалізація без глобального стану: транслятор створюється під конкретну локаль
(per-request / per-render), тож SSR кількох запитів різними мовами безпечний.
У комплекті каталоги `uk` (повний) і `en` (частковий).

Пакет ядра [SimplyCMS](https://github.com/simplyCMS/simplyCMS) — відкритої
e-commerce CMS на TanStack Start + Supabase. Окремо ставити зазвичай не треба:
магазин створюється скаффолдером `pnpm create simplycms-store`, який приводить
усе ядро разом.

## Встановлення

```bash
pnpm add @simplycms/i18n
```

## Що всередині

Єдиний вхід — `@simplycms/i18n` (subpath-експортів немає).

| Символ | Опис |
|--------|------|
| `createTranslator(locale)`   | Транслятор-замикання під локаль: `t(key, params?) → string` |
| `normalizeLocale(input)`     | `'uk-UA'` → `'uk'`, `'EN'` → `'en'`, невідома → `'uk'` |
| `I18nProvider`               | React-провайдер: мемоїзує транслятор по `locale` |
| `useT()`                     | Транслятор поточного рендера; кидає поза провайдером |
| `Locale`, `MessageKey`, `MessageParams`, `Catalog`, `Translator` | Типи. `MessageKey` виводиться з uk-каталогу — union замкнений |

## Приклад

```tsx
// host: src/routes/__root.tsx — провайдер над усіма групами роутів
import { I18nProvider, normalizeLocale } from '@simplycms/i18n';
import config from '../../simplycms.config';

const locale = normalizeLocale(config.locale);
<html lang={locale}>
  <body>
    <I18nProvider locale={locale}>{children}</I18nProvider>
  </body>
</html>;

// сторінка: packages/storefront-routes/src/pages/Cart.tsx
import { useT } from '@simplycms/i18n';

const t = useT();
<h1>{t('cart.title')}</h1>;
<span>{t('cart.items', { count: items.length })}</span>;
```

## 🔴 Глобального `setLocale` немає навмисно

Модульного mutable-стану в пакеті нема — інакше два SSR-запити різними мовами
перетирали б локаль один одному. Резолв ключа — ланцюг «каталог локалі → uk →
сам ключ»: пропущений переклад видно як `cart.title`, а не як мовчазний рядок
чужою мовою.

## Ліцензія

MIT
