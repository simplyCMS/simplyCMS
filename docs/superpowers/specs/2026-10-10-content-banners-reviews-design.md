# Хвиля Е6д «контент: банери й відгуки» — дизайн

> Автор: архітектор К3 (`dashboard-design-spec`). Гілка `claude/k3-e6d-content` від
> `3df42856` (реліз 0.13.0, PR #61). План пише окрема сесія; аудит Codex до відсутності
> blocker; виконання subagent-driven; фінальне рев'ю архітектора від коміту ЦІЄЇ спеки.

Остання хвиля легасі-адмінки К3: після неї `useSupabaseClient` в `admin/` не лишається
(крім `LegacySupabaseBoundary` + його тест — знос у Е7). Сторінки `Banners`, `BannerEdit`,
`Reviews`, `ReviewDetail` переходять на `simplycms/admin-server` + `simplycms/admin-data`.
Магазинів немає — без зворотної сумісності.

## Факти (розвідка 2026-10-10, `3df42856`)

Шляхи — від `packages/simplycms/src`, якщо не сказано інакше.

**Банери**
- Легасі: `admin/pages/Banners.tsx` (список за `sort_order`, перемикач `is_active`, видалення
  БЕЗ підтвердження, `<img src={image_url}>` — сирий референс, бита картинка) і
  `BannerEdit.tsx` (664 рядки: title, subtitle, три картинки `image_url`/`desktop_image_url`/
  `mobile_image_url`, `text_position`, `overlay_color`, `buttons[]`, `placement` +
  `section_id`, розклад `date_from/date_to` + `schedule_days` + `schedule_time_from/to`,
  анімація, `is_active`, `sort_order`). Insert БЕЗ `id` (`BannerEdit.tsx:196`, знає
  `tests/admin-inserts-need-id.test.ts`), `date_from.slice(0,16)` бере UTC як локальний час.
- Схема `schema/schema.ts:1051-1085`: 23 колонки, FK `section_id` SET NULL, **RLS немає**,
  жодних CHECK — `placement`, `text_position`, `animation_type`, форма `buttons` вільні.
  Гранти: `app_user` — `select` (`migrations/0002_grants.sql:64`), `app_admin` — CRUD (:129).
- Вітрина: `storefront/loaders/banners.ts` + `entities/banner.ts` (`toBanner` резолвить 3
  медіа-колонки, `isBannerButton` фільтрує кнопки поелементно, `isBannerVisible` рахує
  розклад) → `contracts/objects/banner.ts` → тема (`HeroBanner`). Контракт вітрини — межа,
  яку адмінка не ламає.
- Завантаження картинок уже на порті (К3-Е2): `admin/components/ImageUpload.tsx` →
  `uploadMedia`, `'banner'` є в `MEDIA_ENTITY_TYPES` (`domain/media.ts`), право
  `media.write`. Адмінка показує референс через клієнтський `resolveMediaUrl` (зразок
  `features/catalog-dictionaries/MediaThumb.tsx`).
- **Права на банери в authz немає** (`auth/authz.ts:28-103`; коментар до `media.write`
  прямо каже, що банери каталогом не є).
- `migrations/demo/demo-seed.sql:262-291`: кнопки `{label, href}` замість контракту
  `{text, url, target, variant}` — демо-банери показуються без кнопок.

**Відгуки**
- Легасі: `Reviews.tsx` (фільтр статусу, без пагінації, імена товарів і профілів двома
  `in(...)`, бейдж «очікують» рахується по ВІДФІЛЬТРОВАНОМУ списку — при фільтрі
  «approved» показує 0; автор `user_id IS NULL` → `'—'`) і `ReviewDetail.tsx` (approve /
  reject з `admin_comment`, видалення; `.eq('user_id', null).single()` — **падає** на
  відгуку видаленого покупця; видалення стирає файли з легасі-бакета `review-images` через
  `supabase.storage`). Серверна частина вже є одна: `admin-server/impl/reviews/content.ts`
  (`getAdminReviewContent`, очищена розмітка, право `review.moderate`).
- Схема `schema.ts:1018-1049`: `user_id` nullable, FK SET NULL (Е6г), `UNIQUE(product_id,
  user_id)`, `status text default 'pending'` і `rating` **без CHECK**, `admin_comment`,
  `images jsonb`. RLS: `app_user` бачить `approved` або свої, пише свої (update — лише
  `pending`), `app_admin` — усе.
- Вітрина: `storefront/loaders/reviews.ts` (`loadProductReviews`, `loadReviewAuthors`,
  `loadProductRatings` — лише `approved`), `reviews-write.ts` (`insertProductReview` завжди
  `pending`), `core/lib/review-form.ts` (`submitProductReview` під `withCustomerDb`).
  `ProductReviewRow` несе `admin_comment` — **внутрішня примітка їде в payload вітрини**.
- Фото у відгуках — мертва фіча: `renderImageUpload` у `reviews-ui/ReviewForm.tsx:21` і
  `ProductReviews.tsx:19` ніхто не передає; `review-form.ts:18` вимагає `z.string().url()`
  (референс — не URL); `'review'` немає в `MEDIA_ENTITY_TYPES`. Колонка `images` є в
  `MEDIA_COLUMNS` і вітрина її резолвить (`toImageList`).
- Зразок заливки файлу покупцем без орфана — аватар (`storefront/loaders/avatar.ts`:
  `writeMedia` у транзакції, `discardMedia` при відкаті, один драйвер на обидва кроки).
- Сід: `scripts/showcase/raw-writes.mts:12-39` — `approveReviews` сирим SQL (борг
  SHOWCASE-1 / С-11: має стати ядром модерації).

**Ратчети, що скорочуються хвилею:** `tests/admin-server-first/registry.ts:35-38`
(`PENDING_LEGACY`, 4 файли), `tests/storage-direct-calls.test.ts:22`
(`STORAGE_DIRECT_CALL_EXEMPTIONS`), `eslint.config.mjs:418-423` (`ignores`),
`tests/mutation-cache-sync-coverage.test.ts:32-33` (`EXEMPT`), текст
`docs/architecture/storage.md:36-37`.

## Рішення власника (2026-10-10)

| № | Питання | Рішення |
|---|---|---|
| Д-1 | Коментар адміна до відгуку | **Внутрішня примітка**, покупець не бачить. Прибрати з проєкції вітрини. |
| Д-2 | Розклад банерів | **Зберегти повністю**: дати + дні тижня + години. |
| Д-3 | Фото у відгуках | **Оживити в Е6д**: покупець додає фото до відгуку, адмін бачить і модерує. |
| Д-4 | Зручності модерації | **Лічильник «очікують»** і **масове схвалення/відхилення**. Перетягування банерів — ні (числове `sort_order`). |

## Дизайн

### 1. Права (authz)

- Нова операція **`banner.manage`** (admin, scope `any`) — CRUD банерів. Окремо від
  `review.moderate`: це різні обовʼязки, а спільне `content.manage` змусило б колись
  розщеплювати право з даними в ролях.
- `review.moderate` — список, картка, зміна статусу (одиночна й масова), видалення,
  лічильник. Наявне право, без змін.
- `media.write` для картинок банера — без змін. Фото відгуку покупця йдуть НЕ через
  `media.write` (див. §4) — право на них дає сам `review.create` у межах власного відгуку.
- Кожна нова операція — рядок у переліку `auth/__tests__/authz.test.ts` і негативний тест
  харнесу «покупець → `AuthzError` з іменем права, БД незмінна» (урок М1 Е6г).

### 2. Банери — ресурс фабрики + колекція

- `admin-server/impl/banners/resource.ts` на `defineAdminResource` (зразок
  `sections/resource.ts`), eager-колекція `admin-data/collections/banners.ts` (зразок
  `pickup-points.ts`). Список малий, CRUD простий — keyset тут зайвий.
- **Валідація — сервер, zod у ресурсі**, бо в БД CHECK-ів немає і вітрина мовчки відкидає
  сміття (`isBannerButton`): `placement` ∈ enum; `section_id` обовʼязковий тоді й лише
  тоді, коли `placement = 'section'`; `text_position`, `animation_type` ∈ enum; кнопки —
  рівно форма `BannerButton` (`text`, `url`, `target ∈ {_self,_blank}`, `variant ∈
  {primary,secondary,outline}`); тривалості в межах легасі-форми; `date_from ≤ date_to`;
  `schedule_time_*` — `HH:MM`; `schedule_days` ⊂ 0…6 без дублів; `overlay_color` — колір
  CSS за тим самим правилом, що й токени теми (не довільний рядок у `style`).
  🔴 Схема валідації — ОДНА, спільна з `entities/banner.ts`, якщо там уже є предикати форми
  (`isBannerButton`): дві копії правила «яка кнопка валідна» розійдуться.
- `id` генерує клієнт колекції (інваріант), `touch: 'updatedAt'`.
- **Картинки:** референси в колонках; у формі `ImageUpload` з `eraseOnRemove={false}`, а
  замінені/прибрані референси стирає СЕРВЕР останнім кроком транзакції update/delete
  (патерн логотипа Е6б-14 + порядок «рядок → обʼєкт» `eraseMedia` К3-Е2). Причина: з
  `eraseOnRemove` за замовчуванням «прибрав картинку → скасував форму» лишає банер із
  мертвим референсом. Якщо фабрика не має хука для цього кроку — план додає його у
  фабрику (а не обходить ресурс), розвилка → архітектору.
- Дати розкладу — через `admin/lib/datetime-local` (`fromDateTimeLocal`), як знижки.
- Видалення — з підтвердженням (AlertDialog), як скрізь у новій адмінці.
- `demo-seed.sql`: кнопки банерів привести до контракту (інакше демо — без кнопок).

### 3. Відгуки — ядра і keyset-список (без колекції)

Патерн Е6г-6 (`customers/list.ts`): потрібні JOIN з товаром і автором, фільтр, потенційно
тисячі рядків.

- `listReviews({ status?, cursor? })` — keyset `(created_at desc, id desc)`, LEFT JOIN
  `products` і `users`/`profiles`. Автор: живий — імʼя/email із посиланням на картку
  `/admin/users/$userId`; `user_id IS NULL` — «Колишній покупець» (ключ i18n адмінки,
  значення як `reviews.formerCustomer` вітрини, але каталог адмінки — свій рівень).
- `countPendingReviews()` — окремий запит, НЕ похідний від відфільтрованого списку (виправляє
  баг бейджа). Показ: бейдж у пункті меню «Відгуки» сайдбару і в заголовку списку.
- `getReviewCard(id)` — рядок, товар (назва, посилання), автор (LEFT JOIN), очищений
  `content` (поглинає `getAdminReviewContent` — одна операція картки замість двох),
  резолвлені фото.
- **Ядро модерації `setReviewsStatus(db, actor: CoreActor, { ids, status, adminComment? })`**
  — одне ядро і для одиночної дії картки, і для масової (Д-4): одна транзакція, `ids` 1…100,
  `status ∈ {approved, rejected, pending}`; `adminComment` пишеться лише тоді, коли
  переданий. Переходи вільні (будь-який → будь-який), текст відгуку адмін не редагує.
  Неіснуючий id у наборі → 409 без часткового запису (не «тихо пропустити»).
  Операція `setReviewsStatusOp` = `requireGrant('review.moderate')` + `withActor` + ядро
  (С-15).
- `deleteReview(db, actor, { id })` — рядок, потім фото (`eraseMedia` останнім кроком).
- **CHECK у схемі:** `product_reviews.status IN ('pending','approved','rejected')` і
  `rating BETWEEN 1 AND 5` (`schema.ts` → `pnpm db:diff` → ревʼю SQL). Зараз сміття в цих
  колонках ламає і бейджі, і рейтинг вітрини мовчки.
- Список: чекбокси рядків + «Схвалити вибрані» / «Відхилити вибрані» (Д-4). Після мутації —
  інвалідація префікса сутності `productReviews` (ключі `entityKey(...).variant(...)`;
  колекції тут немає, тож урок №6 не зачіпає).
- **Сід:** `scripts/showcase` схвалює відгуки ядром `setReviewsStatus` з `{kind:'system'}`;
  `approveReviews` із `raw-writes.mts` зникає (закриває SHOWCASE-1; там лишається лише
  зсув часу).

### 4. Фото у відгуках (Д-3)

- `'review'` додається в `MEDIA_ENTITY_TYPES`.
- **Подача відгуку з фото — ОДИН serverFn** (FormData: поля відгуку + до **5** файлів), за
  зразком аватара: перевірка `inspectUpload` (сніфер MIME + стеля розміру) ДО транзакції;
  у транзакції `withCustomerDb` — `writeMedia` кожного файлу, рядок `media` з
  `entity_type='review'`, `entity_id = reviewId`, insert відгуку з референсами в `images`;
  падіння транзакції → `discardMedia` усіх записаних. Окремого «завантаж спершу, привʼяжи
  потім» НЕМАЄ: він породжує орфани, яких К4-sweep ще не прибирає.
  `userId` — з серверної сесії, ніколи з клієнта.
- Ліміти: до 5 фото, лише `ACCEPTED_IMAGE_MIME`, стеля — `MAX_UPLOAD_BYTES` вітрини (не
  адмінська). Числа — у спільній константі T1, щоб форма й сервер не розійшлися.
- `review-form.ts`: `images` — референси, не `z.string().url()`.
- Вітрина показує фото лише схвалених відгуків (як і текст — RLS + предикат лоадера).
  🔴 Обʼєкти `/media/<key>` роздаються за ключем без перевірки статусу відгуку: фото
  відгуку на модерації доступне тому, хто знає ключ (uuid). Це прийнятно для пілоту і
  записується явно в `storage.md`, а не мовчазне припущення; приватна роздача — борг К4.
- Видалення фото: видалення відгуку адміном чи покупцем (`deleteProductReview`) стирає
  фото тим самим порядком «рядок → обʼєкт». Редагування відгуку покупцем (`pending`) —
  поза хвилею: фото задаються при подачі, змінити їх = видалити відгук і подати новий.
- **Видалення акаунта (GDPR, Е6г):** відгук анонімізується (Г-6), але **фото відгуків
  видаленого покупця стираються** в `deleteCustomer` тим самим кроком, що й аватар
  (`eraseMedia` останнім), а `images` → `[]`. Фото — біометрія/обличчя частіше, ніж текст;
  «лишити анонімно» з Г-6 стосувалося тексту. Реєстр ПД (`ORDER_COLUMN_PRIVACY`) — лише
  для `orders`; тут правило фіксується тестом харнесу видалення.
- Адмінка: фото в картці відгуку (через `resolveMediaUrl`), модеруються разом із відгуком
  (окремого статусу фото немає).

### 5. Вітрина

- `loadProductReviews` більше НЕ проєктує `admin_comment` (Д-1); `ProductReviewRow` без
  цього поля. Тест: payload вітрини не містить ключа `admin_comment`.
- `reviews-ui` вмикає `renderImageUpload` штатно (тема може замінити вигляд, не логіку).

### 6. Знос і ратчети

- Чотири легасі-сторінки видаляються, роути `/admin/banners*`, `/admin/reviews*` ведуть на
  нові фічі `admin/features/{banners,reviews}/`.
- Скорочуються: `PENDING_LEGACY` (−4), `STORAGE_DIRECT_CALL_EXEMPTIONS`, `ignores` у
  `eslint.config.mjs`, `EXEMPT` у `mutation-cache-sync-coverage`; `storage.md` — без
  згадки «мертвої» `ReviewDetail`, з рядком про роздачу фото на модерації.
- Лічильник легасі в `v2-state-map.md` / `platform-roadmap.md` → 2 файли (Е7).

## Що етап доводить

1. `rg useSupabaseClient packages/simplycms/src/admin` → лише `LegacySupabaseBoundary`
   (+ тест); `PENDING_LEGACY` порожній.
2. Харнес (`test:schema`):
   - банери: CRUD, кожне правило валідації з негативним кейсом, стирання заміненої
     картинки (файл зник, рядок оновлено) і відкат (транзакція впала → старий файл живий);
   - відгуки: keyset без дублів і пропусків на межі сторінки; автор `NULL` у списку й
     картці; `countPendingReviews` не залежить від фільтра; масова дія атомарна (один
     неіснуючий id → нічого не змінено); CHECK статусу й рейтингу;
   - подача відгуку з фото: файли й рядки `media` є; падіння транзакції → файлів немає;
     не-зображення / завеликий / 6-те фото → відмова до запису;
   - видалення відгуку і видалення акаунта → фото стерто, рядок/анонімізація на місці;
   - негативний authz для `banner.manage` і кожної операції `review.moderate`.
3. Payload вітрини без `admin_comment`; рейтинг товару змінюється після схвалення ядром.
4. Сід `db:showcase` без `approveReviews` у `raw-writes.mts`; гейт С-8 зелений.
5. `pnpm live:smoke` з кроками: адмін схвалює відгук масово → вітрина показує його;
   покупець подає відгук із фото → адмін бачить фото.
6. Повний ланцюг гейтів зелений; `lint` 0/7.

## Поза хвилею

- Публічна «Відповідь магазину» (Д-1 — ні).
- Перетягування банерів, приватна роздача медіа, sweep орфанів (К4).
- Редагування відгуку покупцем після подачі, окрема модерація фото.
- Загальне шліфування адмінки (рішення власника 2026-10-10 — окремий трек).
