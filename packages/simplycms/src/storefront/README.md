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
| `simplycms/storefront`          | Тип `StorefrontClient` + реекспорт `./loaders` і `./seo` |
| `simplycms/storefront/loaders`  | `withStorefrontDb`, `loadHomePageData`, `loadProduct`, `loadProductList`, `loadSections`, `loadSectionBySlug`, `loadRootSections`, `loadProperties`, `loadPropertyBySlug`, `loadPropertyOption`, `loadDefaultPriceTypeId`, `loadSectionProducts` + типи рядків і мапи колонок (`./entities/*`) |
| `simplycms/storefront/seo`      | `buildSitemapXml(client, baseUrl)`, `buildRobotsTxt(baseUrl)` |

## Як лоадери ходять у БД (В2-К1а)

Лоадери — **server-only** і працюють на Drizzle поверх чистого Postgres.
Перший аргумент кожного — `ActorDb`, тобто drizzle-інстанс, прибіндований до
транзакції конкретного актора. Транзакцію відкриває `withStorefrontDb`:

```ts
import {
  loadSectionBySlug,
  loadProductList,
  withStorefrontDb,
} from 'simplycms/storefront/loaders';

const data = await withStorefrontDb(async (db) => {
  const section = await loadSectionBySlug(db, slug);
  return section ? loadProductList(db, section.id) : [];
});
```

🔴 Обгортка приймає функцію навмисно: усі запити однієї сторінки мають лягти в
**одну** транзакцію, інакше сторінка збирається з різних знімків БД. Роль
актора — завжди `app_user` і без `userId`: вітрина рендериться анонімно.

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
