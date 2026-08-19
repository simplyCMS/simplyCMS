# Трек A: контракт тем v3 «theme views» — імплементація

> Джерело правди — затверджена спека
> [`2026-08-17-theme-contract-v3-views-design.md`](../superpowers/specs/2026-08-17-theme-contract-v3-views-design.md)
> (рішення V1–V5, ревізія D3′/D4′ платформної спеки). Ця задача — її
> приземлення в код. Порядок треків (V5): ревʼю → C → **A** → B; трек C
> (інкременти Б.1–Б.3 механізму клонування) завершено 2026-08-18.
>
> 🔴 Межа сумісності — за D5 і уточненням власника 2026-08-17: реальних
> магазинів немає, breaking дозволений. Але дизайн v3 аддитивний сам по
> собі (`views` опційне) — ламати щось варто лише там, де це чистіше.

## 1. Мотивація (стисло; повна — у спеці §1)

Тема v2.2 впливає на канонічні сторінки лише токенами — всі магазини
платформи структурно однакові, а механізм клонування дизайну впирається в
стелю «структурна розбіжність — приймаємо» (жива таблиця side-by-side
прогону №2: галерея не в картках, trust-бейджі, блок відгуків — недосяжні).
v3 розділяє сторінку на непорушні дані/SEO (ядро) і перевизначуваний
view-шар (тема).

## 2. Скоуп

### Блок A — контрактні типи

- View-model-и пʼяти сторінок вітрини — `Home`, `Catalog`,
  `CatalogSection`, `ProductDetail`, `Cart` — у контрактному шарі
  `@simplycms/objects` (T0, нуль залежностей): їх споживають і ядро, і
  теми. 🔴 Секційна структура (спека §4): поля групуються за майбутніми
  секціями (`ProductDetailViewModel` = `gallery` / `summary` /
  `description` / `characteristics`…), а не плоским мішком — форвард-
  сумісність із треком B. YAGNI: поле існує лише якщо його споживає
  канонічний view.
- `ThemeViews` + опційне `views?` у `ThemeModule`
  (`packages/theme-system/src/types.ts`); `validateThemeModule` — мʼяка
  перевірка форми (відомі ключі, значення-функції); тема без `views`
  повністю валідна (усі наявні теми не міняються).

### Блок B — slot-компоненти комерційних реквізитів

- Готові прибінджені компоненти ядра, які тема лише РОЗСТАВЛЯЄ у своєму
  лейауті: для `ProductDetail` — `AddToCart`, `QuantityPicker`,
  `PriceBlock`, `StockBadge`; для `Cart` — список позицій, сума, перехід
  до checkout; для `Catalog`/`CatalogSection` — картка товару з лінком,
  пагінація. Точний мінімальний склад — з фактичного JSX канонічних
  сторінок (не вигадувати наперед).
- Кожен slot рендерить маркер `data-simplycms-requisite="<name>"` —
  фундамент conformance-гейта. Appearance-пропси (`className` тощо) — для
  стилізації темою; логіка (кошик, стани loading/error) — незламна ядром.
- Тема отримує слоти ЧЕРЕЗ view-model (`vm.slots`), не імпортом з
  `storefront-routes`.

### Блок C — container/view спліт пʼяти сторінок

- Кожна сторінка `packages/storefront-routes/src/pages/<Name>.tsx`
  розділяється: **container** (усе, що є сьогодні: хуки, query, серверні
  дані → збирає view-model зі слотами) і **canonical view** (чиста
  презентація від view-model). Container рендерить
  `theme.views?.<Name> ?? Canonical<Name>View` через наявний
  `useActiveThemeModule`. Каркас (`StorefrontShell`) — не чіпається,
  view живе всередині нього.
- 🔴 View — чиста функція від vm: жодних фетчів даних (i18n/settings-хуки
  дозволені — це render-контекст). Це несуча вимога conformance-гейта
  (рендер на фікстурі без БД).
- Побічний виграш: `ProductDetail.tsx` (722), `Catalog.tsx` (748),
  `CatalogSection.tsx` (786) нарешті розкладаються під канон 150 рядків
  (container і view — окремі файли; за потреби view ділиться на
  підкомпоненти).
- Критерій незмінності канонічного вигляду: механічне перенесення JSX +
  зелені наявні тести. Піксельний side-by-side тим самим `inspect.mjs` —
  жива валідація прогоном №4 ПІСЛЯ цієї задачі (там стенд), не тут.

### Блок D — conformance-гейт (жорсткий, V3)

- Розширення conformance-kit у `@simplycms/themes`: рендер кожного
  ЗАЯВЛЕНОГО темою view на фікстурних view-model-ах (jsdom, без БД) з
  асертами: (а) всі обовʼязкові реквізити сторінки присутні (маркери
  `data-simplycms-requisite`); (б) рендер не падає на крайніх станах
  (товар без фото, порожній кошик, порожня секція).
- Фікстурні vm живуть у ядрі поруч із типами й оновлюються тим самим PR,
  що міняє тип (дрейф структурно неможливий).
- Де червоніє: тести (синтетична тест-тема в юнітах theme-system — і
  валідна, і зламана як негативний контроль); шаблон
  `simplycms create theme` (`packages/cli/template-theme/`) отримує
  conformance-тест з коробки. Рантайм-fallback НЕ робиться — дефект видно
  на гейтах, не маскується (V3).

### Блок E — settings до кінця

- `useThemeSettings` УЖЕ існує (`ThemeContext.tsx:176` — per-key читання);
  довести ланцюг: значення з `themes.settings` (БД) зливаються з
  default-ами `ThemeSettingDefinition`; зміна settings в адмінці
  інвалідовує SSR-кеш теми (та сама механіка, що активація — урок
  лайв-тесту: обхід інвалідації лишає стенд на старих значеннях);
  conformance-рендер обгортається провайдером із default-ами.

### Блок F — доки фактичного стану

- `docs/architecture/themes.md` і `docs/guides/themes.md` — v3 як
  фактичний стан (замість «затверджений напрям»); `CLAUDE.md` розділ
  Theme System; роадмап (трек A — виконано); шаблон/template:sync.

## 3. Чого НЕ робимо (межі — спека §12)

- Checkout / OrderSuccess / auth / profile — view не перевизначаються
  (кандидати v3.1 після обкатки).
- Секційна композиція як дані в БД, drag-and-drop, кастомайзер — трек B.
- Жодна тема в ЦІЙ задачі `views` не постачає: перший реальний споживач —
  default-тема у прогоні №4 (шліфування view-ами) — так валідація
  контракту відділена від валідації клона.
- Рантайм-встановлення тем без rebuild (чинне D1); межа довіри тем (Р10
  Фази 4) — без змін.
- Сід пілота, `scripts/pilot-pack/` — недоторкані.

## 4. DoD

> Відмітки поставлені за фактом виконання (2026-08-18, трек
> `claude/theme-views-v3` — робота велася в сесійних гілках вигляду
> `claude/theme-views-v3-<suffix>`). Усе, що потребує стенду, лишається
> `[ ]` — див. борг наприкінці розділу.

- [X] A: view-model-и пʼяти сторінок у `@simplycms/objects` із секційною
      структурою; `views?` у контракті; `validateThemeModule` мʼяко
      перевіряє форму; всі наявні теми працюють без правок.
- [X] B: slot-компоненти з маркерами `data-simplycms-requisite`; логіка
      купівлі/кошика перенесена БЕЗ зміни поведінки (наявні тести зелені).
- [X] C: пʼять сторінок розкладені на container + canonical view; view —
      чисті (доведено conformance-рендером канонічних view на фікстурах);
      файли під каноном 150 рядків; `theme.views` резолвиться з fallback-ом.
- [X] D: conformance-kit рендерить заявлені views на фікстурних vm і
      червоніє на зламаній синтетичній темі (негативний контроль);
      шаблон `create theme` везе conformance-тест.
- [X] E: ланцюг settings доведений (БД+default-и, інвалідація SSR-кешу
      при зміні, conformance з default-ами) — з тестами.
- [X] F: доки оновлені; `pnpm template:sync`; parity зелений.
- [X] Гейти зелені канонічним порядком + `build:packages`/`test:packaging`
      (зачеплені exports пакетів objects/theme-system/storefront-routes).
- [X] 🔴 `pnpm pilot:pack` зелений: спліт сторінок міняє модульний граф
      route-пакета — рівно той клас поламок, який у монорепо невидимий
      (урок Фази 1: не-serverFn експорт поруч із серверним кодом затягнув
      Supabase у клієнтський бандл; Gate C це ловить).

**Борг — потребує стенду, агентом не виконуваний:**

- [ ] Жива валідація прогоном №4 механізму клонування: піксельний
      side-by-side канонічних сторінок ДО/ПІСЛЯ спліту (доказ незмінності
      вигляду поза «механічне перенесення JSX + зелені тести», Р10) і перший
      реальний споживач `views` — default-тема на щаблі «view теми» фази
      «Шліфування». Обидва пункти прямо винесені за межі цієї задачі (§2 блок
      C, §3) і виконуються окремою сесією після мержу.

## 5. Середовище виконання

Docker/жива БД НЕ потрібні: всі нові тести DB-free (jsdom + фікстурні vm).
`pnpm pilot:pack` теж без БД. Жива валідація (side-by-side, прогін №4) —
окрема сесія після мержу.

## 6. Якорі коду

- Контракт: `packages/theme-system/src/types.ts` (ThemeModule,
  ThemeComponents, ThemeSettingDefinition), `validateThemeModule`,
  `ThemeContext.tsx:176` (`useThemeSettings`), `getActiveThemeSSR.ts`
  (SSR-кеш), `packages/storefront-routes/src/shells/useActiveThemeModule.ts`.
- Сторінки: `packages/storefront-routes/src/pages/{Home(86),Cart(127),
  ProductDetail(722),Catalog(748),CatalogSection(786)}.tsx`;
  add-to-cart зараз: `ProductDetail.tsx:81` (`useCart().addItem`).
- UI-цеглинки сторінок: `packages/catalog-ui` (ProductCard, ProductGallery,
  ProductCharacteristics, FilterSidebar, StockDisplay), `packages/cart-ui`.
- Контрактний шар: `packages/objects/` (T0; тут — view-model-и).
- Шаблон теми: `packages/cli/template-theme/`; синк —
  `scripts/sync-create-store-template.mjs` (`pnpm template:sync`).
- Адмінка settings: `packages/admin/src/pages/ThemeSettings.tsx`;
  таблиця `themes.settings` (jsonb, `packages/schema/src/schema.ts:855`).
- Тіри залежностей: `packages/README.md` (objects = T0 — view-model-и без
  імпортів React-компонентів ядра; типи компонентів — через `React.
  ComponentType`, сам React уже є в deps objects? ПЕРЕВІРИТИ на Кроці 0 —
  якщо ні, типи слотів оголошуються структурно без імпорту react).
