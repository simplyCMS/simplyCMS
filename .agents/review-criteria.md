# Критерії рев'ю simplyCMS — за лінзами

Проєктний файл критеріїв для скіла `landed-review` agent-kit (поле профілю
`review.criteria`). Процедура — шкала, лінзи, поріг, спростування, формат звіту,
правила «як лагодити» — належить скілу; тут лише те, що специфічне для simplyCMS.
Межі й інваріанти — `AGENTS.md`; канон підсистем — `docs/architecture/*`. Якщо цей
файл розходиться з ними, виграє канон, а файл правлять.

## Нотатки проєкту

- **Чутливий код** (усі релевантні лінзи + `history`, два верифікатори на `blocker`):
  auth і request-guard `/admin` (`src/start.ts`, `simplycms/auth`, `simplycms/server-guard`),
  оформлення й замовлення (`simplycms/storefront` лоадери, `simplycms/commerce`,
  `simplycms/inventory`), ціни й знижки (`simplycms/domain` — `pricing`, `discounts`;
  `simplycms/commerce`), права (`simplycms/operations`, RLS і гранти в `simplycms/schema`
  та `packages/simplycms/migrations/`), накат міграцій (`simplycms/migrate`).
- **Доказ запуском:** точковий — `run-tests <рівень> --filter <файл>`; рівень `schema`
  потребує Postgres (`PG_HARNESS_URL`). Повний ланцюг — `pnpm gates`, його не запускає
  рецензент: це робить CI на PR. Packaging-suite (`pnpm test:packaging`) у `pnpm test` не
  входить і працює по зібраних tarball-ах.
- **Генерат:** `src/routeTree.gen.ts` руками не редагується; якщо диф змінив роути, а
  генерат ні — це знахідка.

## Лінза `architecture`

- Напрям залежностей — за таблицею тірів `packages/README.md` (джерело; не переказуй
  із пам'яті). Тір — це **тека** `packages/simplycms/src/<тека>`, а не npm-пакет. Межу
  тримають eslint-тір-зони (`eslint.tier-zones.mjs`, `eslint.tier-relative.mjs`), а не
  `dependencies`: диф порушив напрям, а лінт мовчить — знахідка ще й про зону.
- Теки одного тіру — сиблінги, а не ланка ланцюга (`react-query` і `runtime` один від
  одного не залежать).
- Відомий борг, зафіксований фактом (`packages/README.md`): `plugin-sdk` стоїть T4
  (імпортує `plugins`), а `*-ui` (T4) тягнуть `core` (T5). Позначай, лише якщо диф
  його **додає** або поглиблює.
- Ядро імпортується субшляхом `simplycms/<тека>`, не відносним шляхом через межу тіру і
  не `simplycms` з кореня зсередини пакета (цикл модулів). Барелі не змішують
  server-only і client-safe експорти (`simplycms/contracts/server-only`).
- Зони дифу — за чим перевіряти:

  | Зона | За чим перевіряти |
  | --- | --- |
  | `packages/simplycms/routes/storefront/_storefront*` | SSR: route loaders, дані зі `simplycms/storefront`, каркас із `storefront-routes/shells`, SEO (`storefront-routes/seo`) |
  | `packages/simplycms/routes/admin/*` | client-only: `ssr: false` лише на `admin.tsx` + `pendingComponent`, guard у `src/start.ts`, TanStack Query замість loader-даних |
  | `packages/simplycms/routes/storefront/{_protected*,auth,api}` | auth-гейти, cookie-сесії Better Auth, серверні роути |
  | `createServerFn` будь-де | топ-рівнева константа, валідатор `.validator(…)`, перевірка сесії й ролі, без client-only імпортів; запис адмінки — лише операції реєстру `simplycms/operations` |
  | `routes.ts`, `src/routes/` | дерево збирає `virtualRouteConfig`; host тримає лише `__root.tsx` + `my/` (гард — `tests/virtual-routes-escape.test.ts`) |
  | `packages/simplycms/src/*` | напрям тірів, публічні барелі й вхід у `exports`, ~150 рядків на модуль, без прив'язки до host-`src/` |
  | `themes/*`, `plugins/*` | тема — `manifest+tokens+components` + опційні `views`, без сторінок, лейаутів і логіки; плагін — лише порти `simplycms/plugin-sdk`, без прямих БД-клієнтів |

## Лінза `data-layer`

- Схема: до `1.0.0-rc.1` — правка `schema.ts` → `pnpm db:rebaseline` → ручні файли
  `0002…0004` → `pnpm template:sync` → `pnpm test:schema`; після rc.1 — `pnpm db:diff`.
  Диф, що так робить, не порушує канон.
- Типи БД для нового коду — `simplycms/schema/types` (Drizzle); генератора типів немає.
- Єдиний канал до Postgres — `withActor`; вітрина — `withStorefrontDb`/`withCustomerDb`,
  `userId` лише з серверної сесії, видимість каталогу фільтрує код (`is_active = true`).
- Ключ `id` генерує викликач: у таблицях «Категорії A» немає
  `DEFAULT gen_random_uuid()`, кожна вставка несе явний `id`.
- `queryKey`: сегмент 0 — з реєстру `simplycms/contracts/entities`, не літерал;
  `collectionKey` — лише для колекцій `simplycms/admin-data`.
- Дати в застосунку — `Date`; рядком лише на межі виводу.
- RLS-політики й гранти на кожній зачепленій таблиці; інвалідація кешу відповідає тому,
  що змінили; N+1 у лоадерах.
- Файли — лише порт `simplycms/storage`; у БД лежить референс, не URL.
- Тексти товару — у таблицях перекладів; вітрина читає їх лише з проєкції
  (`docs/architecture/translations.md`).

## Лінза `test-honesty`

- Рівні тестів і що доводить кожен гейт — `docs/architecture/test-contours.md`; нові
  тести — за § 0 (одна поведінка — один рівень; мутація — для інваріантів, гейтів і
  гонок).
- Окремий файл харнеса `pnpm vitest run <path>` не знайде (кореневий конфіг виключає
  `packages/simplycms/test-harness/**`): «No test files found» у кроці RED — хибний доказ.
  Правильно — `run-tests schema --filter <файл>`.
- Зелений `pnpm typecheck` без `pnpm build` нічого не каже, якщо змінились роути:
  typecheck перевіряв застарілий `src/routeTree.gen.ts`.
- Зміна id чи підписів адмінки без grep по `scripts/live-smoke`: `live:smoke` не входить
  у `pnpm gates`, тому застарілий локатор побачить лише смоук.

## Лінза `drift`

- Канон, що дрейфує разом із кодом: `AGENTS.md`, `CLAUDE.md`, `docs/architecture/*`,
  `docs/development/*`, скіли магазину `packages/simplycms/skills/*`.
- Зміна шляху власника магазину без оновлення скіла магазину — знахідка (`AGENTS.md`,
  «Магазин — мінімумом кроків»).
- Копії `template/`, `packages/cli/host/`, `packages/simplycms/migrations/` правляться лише
  `pnpm template:sync`; ручна правка копії — знахідка.
