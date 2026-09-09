# Дослідження: розширення theme-контракту v2 (типографіка, brand, сторінки)

> **Статус:** завершене дослідження, рішення власника ухвалене (див. §7).
> **Дата:** 2026-08-15. Проведено трьома паралельними розвідками (історія
> рішень у доках і git; карта вартості по коду; порівняльний аналіз 9
> еталонних систем) + власна верифікація ключових тверджень.
> **Контекст:** питання виникло з концепту інструмента «редизайн магазину за
> референсом» ([`2026-08-15-website-cloner-tools.md`](2026-08-15-website-cloner-tools.md)) —
> чи справді обмеження контракту тем виправдані для фронту інтернет-магазину.
> **Актуальність якорів:** стан коду після Фази 4 (main `73ad460`). §8 фіксує,
> що з висновків уже закрито самою Фазою 4.

## 1. Чому контракт v2 саме такий — зафіксована історія

### 1.1 Рішення власника (спека платформи, 2026-07-30)

`docs/superpowers/specs/2026-07-30-platform-architecture-design.md:33-35`:

- **D2** — «Адмінка: перевизначення сторінок не існує (модель OpenCart/WP).
  Плагіни лише **додають** сторінки».
- **D3** — «Канонічні сторінки storefront — невідʼємна частина ядра,
  SEO/AI-оптимізовані, не перевизначаються. Магазин вільно додає власні
  сторінки».
- **D4** — «Тема не володіє сторінками: контракт = manifest + tokens +
  brand-компоненти + settings».

Аргументація §6 (рядки 217-220): «Сторінки рендерить **ядро**…
Нова сторінка ядра не ламає жодну тему»; «Повна заміна сторінки —
**поза скоупом v1 (свідомо)**» — тобто відкладено, не заборонено назавжди.

### 1.2 Що було до цього (контракт v1) і як його прибрали

- Контракт v1 вимагав від теми **16 обовʼязкових сторінок + 3 лейаути**
  (`ThemePages`, `MainLayout`/`CatalogLayout`/`ProfileLayout`) — видалено
  комітом `84a77da` (2026-07-31, «feat(themes)!: контракт v2
  tokens+components…», 106 файлів, +1193/−1477). Старий тип:
  `git show 74c65ec:packages/simplycms/theme-system/src/types.ts`.
- Аналітична база — `docs/architecture/platform-delivery-options.md`:
  рядок 22 називає v1 «жорсткий: 3 лейаути + 16 обовʼязкових сторінок,
  жодної опційної»; 86-90 — «Контракт теми — справжнє вузьке місце…
  Мета "оновлення приносить нові сторінки" недосяжна»; §2bis п.3 (118-125)
  явно **скасував** проміжний варіант «опційні сторінки + fallback з ядра +
  capabilities» на користь простішої моделі «тема не володіє сторінками».
- Пізніші амендменти: `messages` (v2.1, коміт `84b7a82`), `displayName`
  у manifest (амендмент §6.1 спеки, Фаза 4).

### 1.3 Виявлений розрив «спека ↔ код» (не рішення, а прогалина)

Спека §6:211 описує токени як «CSS variables: кольори, **типографіка**,
радіуси…», але реалізація свідомо мапнула токени 1:1 на НАЯВНІ
semantic-змінні shadcn («нових `--color-*` не вводимо» —
`packages/theme-system/src/types.ts:20-21`), і типографіка **зникла між
спекою і кодом без зафіксованого рішення**. Жоден документ (спека, роадмап,
борги фаз) не називає її ні запланованою, ні відкинутою. Аналогічно поза
контрактом лишились `--brand-*`-змінні (див. §3.2).

## 2. Порівняльний аналіз еталонних систем

Ключовий висновок: **усі системи, де тема володіє шаблонами сторінок,
хворіють на «заморожену копію + зламаний апгрейд», і всі вони еволюціонують
у бік нашої моделі** (ядро володіє структурою, кастомізація — через
токени/секції/налаштування).

| Система | Одиниця кастомізації | Хто володіє сторінками | Upgrade story | Головний біль |
|---|---|---|---|---|
| WP classic + child themes | повний PHP-шаблон на маршрут + хуки | тема | override «заморожує» файл назавжди | hook-конфлікти; тихий дрейф child від parent |
| WP block themes / FSE | `theme.json` (tokens: color/**typography+fontFace**/spacing/layout) + HTML-шаблони | тема, але user-правки йдуть у БД і «володіють» | БД-копія переважує файл; апдейт не долітає без ручного Reset | той самий outdated-override, лише прихованіше |
| WooCommerce | копія `.php`-темплейта в тему | тема (копія) | `@version`-мітка + ручний diff/re-apply | офіційно deprecated; «№1 причина загадкових багів» |
| OpenCart 3/4 | Twig 1:1 на сторінку + vQmod/OCMOD/events | тема | мажорні версії ламають усе (OC3→4 без сумісності) | кастомізований магазин «майже неможливо» оновити; OC4 викинув OCMOD |
| Shopify OS 2.0 | **секція** (Liquid + `{% schema %}`) + JSON-template композиція | мерчант компонує; код секцій — тема | апдейт заміняє лише незмінені файли; `settings_data.json` окремо | ручні правки Liquid блокують автооновлення |
| Medusa | storefront = 100% власний Next.js | розробник | офіційний гайд: «не merge, переносьте diff вручну»; v1→v2 = «complete rewrite» | rebase-біль стартера задокументований автором |
| Saleor | GraphQL API, фронт окремо | розробник | три покоління офіційного стору (deprecated → cookbook → поточний) | нема стабільного стартера роками |
| shadcn/ui | скопійований `.tsx`-компонент | власник проєкту | `shadcn diff` показує розбіжність із джерелом; merge вручну | «твій компонент — твій баг»; дрейф копій |
| Makeswift/Builder/Plasmic | секція = `registerComponent(Component, schema)` | мерчант компонує в SaaS-редакторі | код — через CI/CD; контент у хмарі вендора | vendor lock-in контенту; третя система обліку |

Отже «у WordPress/OpenCart можна зробити будь-який фронт» — правда, але
ціна цієї свободи задокументована самими спільнотами: саме вона робить
оновлення пеклом. D3/D4 — кінцева точка, до якої вони повзуть
(WP → FSE-токени, Woo → блоковий Cart/Checkout, OC4 → прибрав патч-движки).
Найсильніша модель кастомізації БЕЗ передачі володіння сторінками —
секційна (Shopify sections; у React-світі — патерн `registerComponent` з
props-schema). Модель звірки копій — `shadcn diff` (єдина система, що дала
інструмент, а не «звіряй на око»).

Джерела: [WP Template Hierarchy](https://developer.wordpress.org/themes/templates/template-hierarchy/),
[theme.json](https://developer.wordpress.org/themes/global-settings-and-styles/introduction-to-theme-json/),
[Woo template overrides](https://developer.woocommerce.com/docs/theming/theme-development/template-structure/),
[фікс застарілих Woo-копій](https://developer.woocommerce.com/docs/theming/theme-development/fixing-outdated-woocommerce-templates/),
[OpenCart Theme Editor](https://docs.opencart.com/design/theme-editor),
[критика апгрейдів OC](https://multimerch.com/blog/opencart-problems-bad-upgrades-releases-integrity/),
[Shopify sections](https://shopify.dev/docs/storefronts/themes/architecture/sections),
[JSON templates](https://shopify.dev/docs/storefronts/themes/architecture/templates/json-templates),
[Medusa storefront update guide](https://github.com/medusajs/examples/blob/main/STOREFRONT_UPDATE_GUIDE.md),
[shadcn registry](https://ui.shadcn.com/docs/registry/registry-json),
[Makeswift](https://docs.makeswift.com/developer/reference/runtime/register-component) /
[Builder.io](https://www.builder.io/c/docs/custom-components-setup) /
[Plasmic](https://docs.plasmic.app/learn/registering-code-components/).

## 3. Карта вартості розширень (факти з коду, main `73ad460`)

### 3.1 Типографічні токени + шрифти від теми

- Шрифт зараз один на застосунок: хардкоджений `<link>` Google Fonts Inter
  у `src/routes/__root.tsx:64-66` (синхронна копія — у шаблоні
  скаффолдера і `packages/cli/host/`); `tailwind.config.ts` фіксує
  `fontFamily.sans: ['Inter', …]` буквальним рядком; `@font-face`/`next/font`
  у репо немає ніде. `font-serif` у темах — системний fallback без
  завантаження.
- Механізм токенів — жорсткий allowlist: `TOKEN_KEYS`
  (`packages/theme-system/src/applyTokens.ts:7-32`) + дзеркальний
  `ThemeTokenValues` (`types.ts:27-52`, 23 кольори + `radius`); ключ поза
  списком мовчки не потрапляє в CSS.
- Місця правок для нових токенів: `types.ts`, `applyTokens.ts` (TOKEN_KEYS),
  `tailwind.config.ts` (fontFamily → `var(--font-*)`), fallback у
  `src/styles/globals.css`, теми/шаблони. `validateThemeModule` правити НЕ
  треба — він перевіряє лише `isRecord(tokens)`.
- Канал завантаження шрифту темою відсутній повністю: `ThemeComponents` —
  `React.ComponentType` без пропсів, head-каналу немає. Природний механізм —
  нове опційне поле `ThemeModule.fonts`, рендер поруч із `ThemeTokens`
  у `StorefrontShell` (той самий патерн inline-`<style>`/`<link>` з
  санітизацією, що `applyTokens`; `UNSAFE_VALUE` — `applyTokens.ts:39`).

### 3.2 `--brand-*` і `--sidebar-*`

- `--brand-*`: визначені статично в `src/styles/globals.css:12-15` (лише
  `:root`, без dark), спожиті трьома utility-класами `.gradient-brand*`
  (`globals.css:156-181`), які вживаються рівно тричі:
  `packages/catalog-ui/src/CatalogLayout.tsx:61,153`,
  `packages/cart-ui/src/CartButton.tsx:11` — **воронка покупки**. Наслідок:
  перемикання теми сьогодні НЕ перефарбовує ці градієнти (лишаються кольори
  SolarStore). Рекомендоване рішення — не втягувати в контракт, а
  **розчинити** в семантичні токени (`primary`/`accent`-градієнт).
- `--sidebar-*`: виключно адмінка (`packages/ui/src/sidebar.tsx` через
  `AdminLayout`); адмінка темою свідомо не фарбується (admin-routes не
  монтує ThemeProvider). Лишити поза контрактом — це рішення, не прогалина.

### 3.3 Перевизначення канонічних сторінок

- **Тіньове перекриття роуту файлом у `src/routes/my/` неможливе механічно**:
  всі три `physical()`-теки в `routes.ts` мержаться на одному рівні, і за
  документацією TanStack Router (virtual file routes) дублікат шляху — це
  **помилка генератора**, а не «останній виграє». Перевірено через Context7
  по офіційних доках (`docs/router/routing/virtual-file-routes.md`:
  «If a conflict occurs… the generator will throw an error»).
- Архітектура при цьому готова до **override на рівні компонента сторінки**:
  роути `storefront-routes` тонкі (loader + head/SEO + прокидання пропсів;
  приклади: `routes/_storefront/index.tsx`,
  `routes/_storefront/catalog/$sectionSlug/$productSlug.tsx`), сторінки
  (`src/pages/*.tsx`) — чисті презентаційні компоненти без імпорту Router.
  Модель: мапа в `simplycms.config.ts` (`pages: { home: MyHome }`) →
  канонічний роут рендерить override з тими самими пропсами. Loader, SEO,
  редіректи лишаються в ядрі; контрактом стає TS-інтерфейс пропсів —
  зламна зміна ядра виявляється на `typecheck`, а не мовчазним багом
  (перевага над WP/Woo/OC, де копія забирає і логіку). Потребує амендменту
  D3 — рішення власника.
- Секційна модель (Shopify-подібна: реєстр секцій зі схемами + композиція
  сторінки в БД + редактор в адмінці) — стратегічно найсильніша, але це
  великий платформний проєкт; слово «секція» у спеці не зустрічається —
  напрям ще не проєктувався. `HomeSections` + `PluginSlot` + `settings` —
  її зародок.

### 3.4 Контури якості (стан ПІСЛЯ Фази 4)

- i18n `SCANNED_ROOTS` (`tests/i18n-coverage/scan.ts`) — **автодискаверить**
  теми з диска (обидва корені: `themes/*` і `packages/simplycms-theme-*`).
- `tests/theme-messages-parity.test.ts` — автодискаверить обидва корені;
  eslint i18n-глоб `themes/*/components/**/*.tsx` (`eslint.config.mjs:44`)
  покриває нову тему автоматично; `src/**` покриває майбутні
  override/кастомні сторінки.
- Пілот: Gate THEME-контур (`scripts/pilot-pack/install-themes.mjs` — copy-in
  і npm реальними CLI-командами), Gate D-маркер solarstore.
- `PluginSlot` на канонічних сторінках — лише `ProductDetail.tsx`
  (3 виклики) і `Checkout.tsx` (2 виклики); решта 14 сторінок без точок
  розширення.
- Схема `themes` у БД: `packages/schema/src/schema.ts:846-863`
  (`name` unique, `is_active` + частково унікальний індекс, `settings`
  jsonb, RLS «Admins can manage themes»).

## 4. Відповідь на питання власника

Вузькість контракту **виправдана у своєму ядрі** (сторінки в ядрі — модель,
до якої зійшлася індустрія), але **дві частини вузькості — випадкові**:

1. типографіка/шрифти — прогалина реалізації проти власного тексту спеки;
2. `--brand-*` — кольори воронки поза досяжністю теми (перемикання теми
   не перефарбовує магазин повністю).

І одна частина — свідомо відкладена, з дешевим для нас шляхом реалізації,
якщо колись знадобиться: перевизначення презентації сторінок (§3.3).

## 5. Три горизонти (матеріал рішення)

| Горизонт | Що | Статус рішення |
|---|---|---|
| **1. Контракт v2.2** | типографічні токени + `ThemeModule.fonts` + розчинення `brand-*` у семантичні токени + амендмент §6 спеки | у межах чинних D2–D4 |
| **2. За реальним попитом** | store-level page-presentation overrides (мапа в конфігу, пропси — контракт, SEO/loader у ядрі) | потребує амендменту D3; відкривати, коли редизайн-кейси впруться в стелю горизонту 1 |
| **3. Стратегія (Фаза N)** | секційна модель сторінок + no-code композиція в адмінці | зафіксувати в роадмапі як напрям, не проєктувати зараз |

## 6. Вплив на інструмент «редизайн за референсом»

Горизонт 1 піднімає стелю інструмента з «перефарбувати» до «перефарбувати +
шрифти + повністю власні Header/Footer/HeroBanner/HomeSections» — для
більшості референсів достатньо. Горизонт 2 — відповідь на «хочу каталог як
у референса», з чесною межею: override живе в магазині, оновлення ядра його
не редизайнить. Деталі концепту інструмента — у парному ресерчі
[`2026-08-15-website-cloner-tools.md`](2026-08-15-website-cloner-tools.md).

## 7. Рішення власника (2026-08-15)

Прийнято: **спершу горизонт 1 (розширення theme-провайдера, контракт
v2.2), потім поверх нього — інструмент редизайну за референсом.**
Горизонти 2–3 — рішення-кандидати на майбутнє, зараз не виконуються.
Сценарій виконання: план → адверсаріальне ревʼю плану скептиками →
`/виконай-задачу` → ревʼю результату.

## 8. Що з висновків уже закрила сама Фаза 4 (не дублювати)

- ~~«SCANNED_ROOTS — ручний список»~~ — автодискаверинг зроблено.
- ~~«скаффолд теми — окремий скрипт»~~ — є `simplycms create theme`
  (+ `add --theme` / `--copy`); інструмент редизайну спирається на CLI.
- ~~«активація нової теми — ручний клопіт»~~ — `bootstrapThemes` +
  registry-awareness адмінки.
- ~~«semver engines не перевіряється»~~ — warn-перевірка у
  `validateThemeModule`.
- Заувага «`getActiveThemeSSR` — мертвий код» знята з порядку денного:
  канон Фази 4 (`docs/architecture/themes.md` §6) описує його як робочу
  ланку SSR-fallback; за потреби — окрема дрібна звірка, не частина цього
  треку.
