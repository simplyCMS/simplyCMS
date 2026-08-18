# План: трек A — контракт тем v3 «theme views»

> Задача (скоуп, DoD, якорі): [`docs/tasks/theme-views-v3.md`](../../tasks/theme-views-v3.md).
> Спека (джерело правди рішень V1–V5): [`2026-08-17-theme-contract-v3-views-design.md`](../specs/2026-08-17-theme-contract-v3-views-design.md).
> Базова гілка треку: `claude/theme-views-v3` (сесійна гілка виконавця
> мержиться PR-ом у неї — модель інкрементів Б.2/Б.3).
> Середовище: Docker/жива БД НЕ потрібні — всі нові тести DB-free
> (jsdom + фікстурні view-model-и); `pnpm pilot:pack` теж без БД.
>
> 🔴 Після КОЖНОЇ фази репо зелене: `format:check → lint → build →
> typecheck → test`. Повний ланцюг із `build:packages → test:packaging` —
> у фіналі КОЖНОЇ фази, що чіпає exports пакетів (фактично — всіх), а
> `pnpm pilot:pack` — обовʼязково у фінальній фазі і РЕКОМЕНДОВАНО після
> фаз 3–5 (спліт сторінок міняє модульний граф route-пакета — клас
> поламок, невидимий у монорепо; урок Фази 1, Gate C).

## Зафіксовані рішення (Р1–Р12)

- **Р1. View-model-и — у `@simplycms/objects`** (T0). Дані — чисті
  типи/DTO. Типи slot-компонентів — БЕЗ імпорту react у T0: структурний
  тип функції-компонента (`(props: SlotAppearanceProps) => unknown`) або,
  якщо на Кроці 0 виявиться, що чистіше, — slots-типи в
  `@simplycms/themes` поруч із `ThemeViews`, а в objects лише
  data-частина. Рішення ухвалює виконавець НА КРОЦІ 0 і документує тут;
  вимога незмінна: тема НЕ імпортує `storefront-routes`.
- **Р2. Секційна структура vm** (спека §4): `ProductDetailViewModel` =
  `gallery` / `summary` / `description` / `characteristics` (+ `slots`);
  аналогічно решта. Склад полів — з ФАКТИЧНОГО JSX канонічних сторінок
  (YAGNI: жодного поля «на майбутнє»).
- **Р3. Slot-компоненти** — `packages/storefront-routes/src/views/slots/`;
  прибінджені до engine-хуків, SSR-safe; кожен рендерить
  `data-simplycms-requisite="<name>"`; appearance-пропси мінімальні
  (`className?`). Логіка (useCart, стани loading/error, toast) —
  переноситься з канонічних сторінок БЕЗ зміни поведінки.
- **Р4. Container/view спліт**: `pages/<Name>.tsx` = container (дані →
  vm → `theme.views?.<Name> ?? Canonical<Name>View`); канонічні view —
  `packages/storefront-routes/src/views/<Name>View.tsx` (+ підкомпоненти
  за потреби, канон 150 рядків). Резолв теми — наявний
  `useActiveThemeModule`; `StorefrontShell` не чіпається.
- **Р5. Чистота view**: жодних фетчів у view; `useT`/`useThemeT`/
  `useThemeSettings` дозволені (render-контекст). Conformance рендерить
  view у провайдерах i18n + settings-default — і КАНОНІЧНІ view теж
  проходять conformance (це водночас доказ їх чистоти).
- **Р6. Фікстурні vm** — у ядрі поруч із типами (одне джерело з типами,
  оновлюються тим самим PR); мінімум два стани на сторінку: повний і
  крайній (без фото / порожній кошик / порожня секція).
- **Р7. Conformance-kit** — `packages/theme-system/src/conformance/`:
  `assertThemeViewsConformance(theme)` — jsdom-рендер кожного ЗАЯВЛЕНОГО
  view на фікстурах + асерт обовʼязкових реквізитів по
  `data-simplycms-requisite` + крайні стани без падіння. Мінімальний
  склад реквізитів по сторінках фіксується константою поруч із kit-ом
  (джерело — фактичні слоти Р3). Рантайм-fallback НЕ вводиться (V3).
- **Р8. Негативний контроль conformance** — синтетична тест-тема в юнітах
  theme-system: валідна проходить; зламана (без AddToCart / падає на
  порожньому кошику) — червона. Шаблон `create theme`
  (`packages/cli/template-theme/`) отримує conformance-тест з коробки
  (views у шаблоні закоментовані — тест на це реагує чесним skip/pass).
- **Р9. Settings**: `useThemeSettings` існує (`ThemeContext.tsx:176`) —
  довести ланцюг: (а) merge БД-значень із default-ами
  `ThemeSettingDefinition` (де саме — зʼясувати Кроком 0: ThemeContext чи
  адмінка); (б) інвалідація SSR-кешу теми при збереженні settings —
  ДЗЕРКАЛО механіки активації (знайти її і викликати ту саму); (в)
  провайдер default-ів у conformance.
- **Р10. Регрес канонічного вигляду**: механічне перенесення JSX + зелені
  наявні тести + conformance канонічних view. Піксельний side-by-side —
  прогін №4 після мержу (стенд), НЕ в цій задачі.
- **Р11. Жодна тема views не постачає** в цій задачі (перший споживач —
  прогін №4); `themes/default` не чіпається взагалі.
- **Р12. Доки** правляться ОСТАННЬОЮ фазою (описують фактичний стан);
  відхилення від спеки — амендментом §-приміткою в спеці + рядком тут.

---

## Фаза 1 — Контрактні типи + фікстури

- [ ] **Step 1:** view-model-и пʼяти сторінок у `@simplycms/objects`
      (Р1/Р2) — склад полів знятий з фактичного JSX сторінок (читання,
      без правок сторінок).
- [ ] **Step 2:** `ThemeViews` + `views?` у `ThemeModule`
      (`packages/theme-system/src/types.ts`); `validateThemeModule` —
      мʼяка перевірка форми + юніти (тема без views валідна; невідомий
      ключ — warn/error за ідіомою наявного валідатора).
- [ ] **Step 3:** фікстурні vm (Р6) + тест парності «фікстура відповідає
      типу» (компіляція + рантайм-форма).
- [ ] **Step 4:** гейти фази (+ `build:packages`/`test:packaging` —
      exports objects/theme-system зачеплені).

## Фаза 2 — Slot-компоненти реквізитів

- [ ] **Step 1:** інвентаризація реквізитів по фактичному JSX
      (ProductDetail: add-to-cart `:81`, кількість, ціна, наявність;
      Cart: позиції/сума/чекаут; Catalog/Section: картка з лінком,
      пагінація) — зафіксувати мінімальний склад константою (вона ж
      джерело для conformance Р7).
- [ ] **Step 2:** `src/views/slots/` — компоненти з маркерами (Р3);
      логіка перенесена, поведінка незмінна (наявні тести сторінок
      зелені ще ДО спліту — сторінки тимчасово споживають слоти прямо).
- [ ] **Step 3:** DB-free юніти слотів (jsdom + моки engine-хуків):
      маркер присутній, стани рендеряться.
- [ ] **Step 4:** гейти фази.

## Фаза 3 — Спліт ProductDetail (пілотна сторінка)

- [ ] **Step 1:** `ProductDetailView` (канонічний, чистий) +
      container збирає vm зі слотами; резолв
      `theme.views?.ProductDetail ?? ProductDetailView`.
- [ ] **Step 2:** conformance-прогін канонічного view на фікстурах
      (повний + без фото) — це і тест чистоти.
- [ ] **Step 3:** юніт резолву: синтетична тема з `views.ProductDetail`
      рендериться ЗАМІСТЬ канонічного; без views — канонічний.
- [ ] **Step 4:** гейти фази + `pnpm pilot:pack` (перший спліт — перша
      перевірка модульного графа).

## Фаза 4 — Спліт Catalog + CatalogSection

- [ ] **Step 1:** той самий патерн, що Фаза 3 (обидві сторінки ділять
      view-model `CatalogViewModel`/`CatalogSectionViewModel` — спільні
      підкомпоненти view не дублювати).
- [ ] **Step 2:** conformance канонічних view (повний + порожня секція).
- [ ] **Step 3:** гейти фази (+ рекомендовано pilot:pack).

## Фаза 5 — Спліт Home + Cart

- [ ] **Step 1:** Home: container уже тонкий (86 рядків) — vm збирає
      banners/секції; взаємодія з наявними theme-компонентами
      (`HeroBanner`/`HomeSections`) НЕ ламається: вони лишаються
      контрактом v2.2, канонічний HomeView їх рендерить як зараз.
- [ ] **Step 2:** Cart: спліт + слоти позицій/суми/чекауту.
- [ ] **Step 3:** conformance (порожній кошик — обовʼязковий крайній
      стан) + гейти фази (+ рекомендовано pilot:pack).

## Фаза 6 — Conformance-kit як публічний контракт

- [ ] **Step 1:** `assertThemeViewsConformance` — публічний експорт
      `@simplycms/themes` (субшлях за ідіомою `safeFontStylesheets`,
      якщо barrel тягне серверне).
- [ ] **Step 2:** негативний контроль (Р8): зламана синтетична тема —
      червона; валідна — зелена.
- [ ] **Step 3:** шаблон `create theme`: закоментований приклад `views`
      у `index.ts` + conformance-тест з коробки + README-розділ.
- [ ] **Step 4:** гейти фази.

## Фаза 7 — Settings-ланцюг

- [ ] **Step 1:** merge БД-значень із default-ами definitions (Р9а) —
      з тестом (значення без запису в БД → default).
- [ ] **Step 2:** інвалідація SSR-кешу при збереженні settings в адмінці
      (Р9б) — дзеркало активації, з тестом на виклик інвалідації.
- [ ] **Step 3:** conformance-провайдер default-ів (Р9в) + тест: view,
      що читає setting, рендериться на фікстурі без БД.
- [ ] **Step 4:** гейти фази.

## Фаза 8 — Доки, синк, фінальні гейти

- [ ] **Step 1:** `docs/architecture/themes.md` — v3 як фактичний стан
      (контракт, views, conformance, settings; блок «затверджений
      напрям» знімається); `docs/guides/themes.md` — how-to автора view.
- [ ] **Step 2:** `CLAUDE.md` (розділ Theme System → v3), роадмап
      (трек A — виконано), спека — амендменти, якщо були відхилення.
- [ ] **Step 3:** `pnpm template:sync`; parity зелений.
- [ ] **Step 4:** фінал: повний ланцюг гейтів + `build:packages` +
      `test:packaging` + **`pnpm pilot:pack`**.
- [ ] **Step 5:** відмітки DoD у задачі.

## Верифікація (для окремого верифікаційного воркфлоу)

1. Усі наявні теми (default, solarstore) працюють без жодної правки —
   `git diff` по `themes/`, `packages/simplycms-theme-solarstore/`
   порожній.
2. Негативні контролі: зламана синтетична тема червонить conformance;
   відкат резолву `theme.views` червонить юніт фази 3.
3. Чистота view доведена conformance-рендером БЕЗ БД (жоден view не
   робить фетч — інакше рендер на фікстурі впав би).
4. Канон 150 рядків по всіх нових/розкладених файлах.
5. `pnpm pilot:pack` зелений (Gate A/C/D: route-id, бандл-межі, Tailwind).
6. Заборонені зони: `scripts/pilot-pack/`, `supabase/seed.sql`,
   `themes/**` — недоторкані.
