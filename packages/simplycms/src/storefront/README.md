# simplycms/storefront

SSR-лоадери вітрини (товари, розділи, характеристики, головна) і генератори
`sitemap.xml` / `robots.txt`.

Шар ядра [SimplyCMS](https://github.com/simplyCMS/simplyCMS) — відкритої
e-commerce CMS на TanStack Start. Окремим пакетом він більше не постачається:
усе ядро приходить одним npm-пакетом `simplycms`, а магазин створюється
скаффолдером `pnpm create simplycms-store`.

## Встановлення

```bash
pnpm add simplycms
```

Вхід цього шару — субшлях `simplycms/storefront`.

## Що всередині

| Subpath | Експорти |
|---------|----------|
| `simplycms/storefront`          | Реекспорт `./loaders` і `./seo` |
| `simplycms/storefront/loaders`  | `withStorefrontDb`, `withViewerDb` (ціни лише видів глядача сесії, Р29), `loadHomePageData`, `loadProduct`, `loadProductList`, `loadSections`, `loadSectionBySlug`, `loadRootSections`, `loadProperties`, `loadPropertyBySlug`, `loadPropertyOption`, `loadDefaultPriceTypeId`, `loadSectionProducts` + типи рядків і мапи колонок (`./entities/*`) |
| `simplycms/storefront/seo`      | `buildSitemapXml(client, baseUrl)`, `buildRobotsTxt(baseUrl)` |

## Як лоадери ходять у БД (В2-К1а)

Лоадери — **server-only** і працюють на Drizzle поверх чистого Postgres.
Перший аргумент кожного — `ActorDb`, тобто drizzle-інстанс, прибіндований до
транзакції конкретного актора. Публічне читання БЕЗ цін відкриває
`withStorefrontDb` (`app_user` без `userId`). Лоадери з цінами (`loadProduct`,
`loadProductList`, `loadCatalogProducts`, `loadPropertyOption`, `loadHomePageData`,
`loadHomeProducts`, `loadSectionProducts`) приймають обовʼязковий `viewer` —
набір видів цін глядача (Р29) — і відкриваються лише через `withViewerDb`.
Списки й добірки товару (`loadProductList`, `loadCatalogProducts`, `loadPropertyOption`,
`loadHomePageData`, `loadHomeProducts`, `loadSectionProducts`) та оформлення
(`quoteCartFor`, `quoteCheckoutFor`, `placeOrderFor`) приймають також `text: TextLocale`
(`{ locale, primary }`) — мову читання тексту товару: назва, адреса й короткий опис — з проєкції
`catalog_product_texts` у цій мові, неперекладене — з основної. Мову клієнта звіряє з
опублікованими `resolveTextLocale`:

```ts
import {
  loadSectionBySlug,
  loadProductList,
  resolveTextLocale,
  withViewerDb,
} from 'simplycms/storefront/loaders';

const text = await resolveTextLocale(locale);
const data = await withViewerDb(async (db, viewer) => {
  const section = await loadSectionBySlug(db, slug);
  return section ? loadProductList(db, viewer, text, section.id) : [];
});
```

🔴 Обгортка приймає функцію навмисно: усі запити однієї сторінки мають лягти в
**одну** транзакцію, інакше сторінка збирається з різних знімків БД.

🔴 `viewer` береться **лише** із серверної сесії: `withViewerDb` читає
`readSessionSubject`, гостю дає гостьові види цін (`app_user` без `userId`),
покупцю — вид його категорії + гостьові (`app_user` з його `userId`), а
відповідь залогіненому позначає `Cache-Control: private, no-store`. Параметра,
яким клієнт назвав би свій вид чи категорію, немає й не має бути: хто називає
свою категорію, той називає й свій прайс. Ядро без сесії (`withViewerPricesDb`)
свідомо не експортується.

## 🔴 Видимість фільтрує КОД, а не база

У моделі безпеки B5″ на каталозі немає RLS: `app_user` має `SELECT` на всю
таблицю, бо «активність» — це правило показу, а не право доступу. Отже кожен
публічний запит зобовʼязаний нести предикат видимості явно
(`is_active = true` для товарів, розділів і банерів; `has_page = true` для
характеристик). Забутий предикат не дає помилки — він тихо виводить чернетки
у вітрину. Негативний контроль — `test-harness/pg/__tests__/storefront-loaders.test.ts`
(контур `pnpm test:schema`).

## 🔴 `buildSitemapXml` кидає, а не віддає порожню карту

Помилку запиту sitemap НЕ ковтає: карта з самих лише статичних URL виглядає як
успіх, і кеш-заголовок (година + SWR) зафіксував би цю неправду для пошукових
роботів. Краще 5xx без кешу — обробляти виняток має host.

## Ліцензія

MIT
