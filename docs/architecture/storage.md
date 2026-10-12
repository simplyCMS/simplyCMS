# Сховище файлів

Файли живуть за портом **`simplycms/storage`** — server-only піддерево (за
декларацією `contracts/server-only`). Драйверів два, обидва реалізують той самий
інтерфейс `MediaStorageDriver` (`put`/`delete`/`open`), контракт не змінювався:

- **`local-fs`** — дефолт self-host (диск, корінь із `MEDIA_ROOT` лише через резолвер `simplycms/env`
  — порожнє значення це «не задано», дефолт `./.data/media`
  відносно робочої теки процесу; у проді — змонтований том, бо дефолт лежить усередині
  теки деплою);
- **`s3`** (`storage/s3.ts`) — S3-сумісне сховище (Garage, MinIO, AWS) на `aws4fetch`:
  path-style URL `<endpoint>/<bucket>/<key>`, ліниво створений клієнт, помилки лише з методом
  і статусом (`S3 GET не вдався: 500`) — тіло відповіді й ключі доступу в текст не потрапляють.

## Вибір драйвера

`getMediaDriver()` (`storage/select.ts`) обирає драйвер за env через `resolveDriverEnv`
(`simplycms/env`) і мемоізує його на процес. Група S3 — п'ять ключів: `S3_ENDPOINT`,
`S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`.

- Задані **всі п'ять** → `s3`. Не задано **жодного** → `local-fs` (з `MEDIA_ROOT` або дефолтом).
- 🔴 **Все або нічого:** часткова група кидає `DriverEnvError` з іменами відсутніх ключів (не
  значень). Мовчазний фолбек на диск був би гіршим за падіння: забутий `S3_REGION` у Dokploy
  тихо поклав би файли в контейнер, що зникне з редеплоєм. `MEDIA_ROOT` при активному `s3`
  ігнорується (попередження повертає резолвер, друкує викликач).
- `selectMediaDriver(media)` — чиста відповідність «розвʼязана група → драйвер» без кешу; її перевіряє `select.test.ts`.

**У БД лежить РЕФЕРЕНС, не URL.** Референс — storage key (`ab/<uuid>.<ext>`) для
завантаженого файлу; зовнішні `https?:`, вбудовані `data:` і корене-відносні `/…`
проходять як є. Резолв у URL — одна чиста функція `resolveMediaUrl`
(`simplycms/domain/media`, T1, клієнтобезпечна); роздача — `/media/*`
(`packages/simplycms/routes/storefront/media/$.tsx`).

## Правила

- Завантаження й видалення — **лише serverFn**: `uploadMedia`
  (`simplycms/admin-server`) для адмінки (прибрати файл окремим serverFn не можна: заміну чи видалення сутності стирає сервер, сироту — sweep), `uploadMyAvatar`/`removeMyAvatar`
  (`simplycms/core/lib/profile-avatar`) для кабінету, `submitProductReview`/
  `deleteMyProductReview` (`simplycms/core/lib/review-form`) для фото відгуку:
  до 5 файлів по 5 МБ одним `FormData`-запитом разом із текстом, усі перевірені
  ДО першого запису (Е6д-5, Е6д-6).
- Рядок `media` і файл пишуться **однією транзакцією актора** — `writeMedia(db, …)`;
  якщо транзакція впала, вже опублікований файл прибирається через outbox
  (`scheduleMediaErasures` + `completeMediaErasures`, Е6д-20б) у `catch` ЗОВНІ
  транзакції. Цю пару інкапсулює `withPublishedRollback(run, discardWith?)`
  (`storage/rollback.ts`): `run` викликає `track(ref)` одразу після кожного `writeMedia`,
  а помічник на відмові ставить хвіст і стирає. Ним користуються подача й правка відгуку,
  `replaceAvatar` і адмінський `uploadMedia`.
- 🔴 **Власник обовʼязковий:** `uploadMedia` без `entityId` → 400 (виняток — `store_logo`,
  власник якого фіксований, `STORE_LOGO_OWNER_ID`).
- 🔴 **Видалення — двофазне (Е6д-14, КАНОН):** «транзакція видаляє лише рядки
  `media`; файли стираються ПІСЛЯ COMMIT (`completeMediaErasures`); найгірший наслідок —
  орфан-файл без рядка, битий референс неможливий». Механіка:
  - 🔴 **Outbox `media_erasures` (Е6д-20):** `eraseMediaRows` у ТІЙ САМІЙ транзакції ставить
    рядок на кожен ключ (відкат прибирає обидва); `completeMediaErasures(keys)` після COMMIT
    стирає файл і знімає рядок, а збій лишає рядок (`attempts`, `last_error`) і нічого не
    кидає. `driver.delete` виконується ПОЗА транзакцією: короткий крок бере хвости
    (`FOR UPDATE SKIP LOCKED`) і бронює їх (`requested_at = now()`, щоб паралельний
    викликач не стирав ті самі), далі стирається файл, окремий короткий крок знімає
    рядок або пише помилку. Опортуністично добираються до 5 хвостів старших за хвилину;
    `retryMediaErasures` (адмінка, налаштування, право `media.write`) повторює вручну,
    `listMediaErasures` показує хвости. Транзакція outbox — службова (`app_admin` без
    `userId`, Е6д-20а). Драйвер мусить мати ідемпотентний `delete` (стерти вже стертий —
    не помилка). Межа: БД недоступна саме в момент відкату → файл без рядка `media` і без
    хвоста; роздача його не віддає (Е6д-21), а sweep (нижче) змете;
  - `eraseMediaRows(db, refs, owner)` (`storage/record.ts`) у транзакції:
    `SELECT … WHERE storage_key = ANY($refs) AND entity_type = $owner.entityType
    AND entity_id = $owner.entityId ORDER BY storage_key FOR UPDATE` → `DELETE` →
    повертає ЛИШЕ ключі рядків, які справді видалив. Ключ без рядка `media`
    (чужий, `data:`, уже стертий) у результат не потрапляє — його файл ніхто не стирає;
  - ядро повертає ключі явно (`{ …, discard: string[] }`), а операція кличе
    `completeMediaErasures` кожного ключа ПІСЛЯ `runAdmin`/`runAdminTransactions`; сід — після
    своєї транзакції. Неявного after-commit хука в `withActor` **немає**;
  - 🔴 власність ключа перевіряє сховище, а не викликач (Е6д-16): `owner`
    обовʼязковий, перевантаження без нього немає, ключі чужого власника тихо
    ігноруються. Власники: відгук — `{ entityType: 'review', entityId: reviewId }`;
    аватар у `deleteCustomer` — `{ entityType: 'avatar', entityId: userId }`;
    фабрика `admin-data` — `{ cfg.entityType, <id рядка> }`, окремий виклик на рядок
    (опція `media`, Е6д-1 — `data-layer.md`);
  - двофазно працюють: фабрика (банери), модерація й видалення відгуків, видалення
    власного відгуку покупцем, `deleteCustomer` (аватар разом із фото відгуків),
    видалення товару (фото його відгуків, опція `cascadeMedia`, Е6д-19).
  - 🔴 **Каскад БД рядків `media` не бачить (Е6д-19):** рядок із медіа, який знищує FK
    `ON DELETE CASCADE`, лишив би рядки `media` і файли — публічні за URL і недосяжні
    для подальших стирань. Шлях видалення батька мусить стерти їх сам: у фабриці —
    опція `cascadeMedia` (`data-layer.md`), в іменованій операції — `eraseMediaRows`
    до COMMIT. Гейт класу `test-harness/pg/__tests__/media-cascade-coverage.test.ts`
    звіряє кожну каскадну медіа-колонку з каталогу FK з покриттям або винятком із
    причиною.
  - аватар (`replaceAvatar`/`removeMyAvatar`), логотип магазину (Е6б-14) теж двофазні (К3-Е6д-3): винятків із двофазного канону немає.
    `ImageUpload` файл сам не стирає, а сироту, лишену скасованою формою, прибирає sweep
    (він звіряє `findMediaReferences`, див. «Посилання на медіа»).
- Фото відгуку (Е6д-5): `'review'` свідомо **не** в `MEDIA_ENTITY_TYPES` — той
  список є allowlist адмінського `uploadMedia`, а сценарію «адмін вантажить фото
  відгуку» немає (як і `'avatar'`, пишеться повз список). Константи —
  `REVIEW_MEDIA_ENTITY = 'review'`, `MAX_REVIEW_IMAGES = 5`,
  `MAX_REVIEW_IMAGE_BYTES = 5 МБ` (`simplycms/domain/media`); кількість і розмір
  КОЖНОГО файлу звіряються до першого `writeMedia`. Тіло запиту має стелю
  (`bodyLimitMiddleware`, `MAX_REQUEST_BODY_BYTES` = найбільше з доменних лімітів +
  `MULTIPART_OVERHEAD_BYTES`; відмова 413 `request/payload-too-large`, без
  `Content-Length` — 411 `request/length-required` для всього, що не JSON і для всього, що Start читає як форму; база шляху — `TSS_SERVER_FN_BASE`;
  К3-Е6д-2, `ENVIRONMENT.md`). Межа: UI відсікає завелике ДО відправки, тож прямий
  виклик повз UI може побачити обрив зʼєднання замість 413 (`UPSTREAM:START-BODY-1`,
  `upstream-workarounds.md`).
- Покупець видаляє власний відгук (Е6д-9): `app_user` не має `DELETE` на `media`,
  тож рядки фото стирає ескалація `operator`, і лише ключі з `RETURNING images`
  рядка, який ЦЯ транзакція видалила як власний (`user_id` — із сесії), а не з вводу
  клієнта; `eraseMediaRows` ще звіряє власника `review/<id>`.
- Покупець редагує власний відгук (Е6д-23): `updateProductReviewWithImages`
  (`storefront/loaders/reviews-edit.ts`) — FormData `id, rating, title, content, keep[],
  images[]`; `keep` мусить бути підмножиною наявних `images` (інакше 409
  `review/images-changed`), нові фото пишуться `writeMedia` у `withPublishedRollback`,
  прибрані стирає `eraseMediaRows` через `operator` (власник `review/<id>`) і
  `completeMediaErasures` після COMMIT. Правка завжди повертає статус `pending`, а
  `admin_comment` не чіпає. Колонковий `UPDATE (rating, title, content, images, status,
  updated_at)` і політики RLS — `data-layer.md` (розділ про гранти); грант не дає
  підсунути в `images` чужий ключ, це перевіряє порт. Чужі фото `own_photos` віддаються
  лише автору.
- Значення медіа-колонки-масиву (`images`) нормалізує одна чиста функція
  `normalizeMediaRefs` (`simplycms/domain/media`): лише непорожні рядки, не-масив →
  `[]`. Колонки — nullable `jsonb` без CHECK форми.
- Споживачі порту з вітрини — ратчет `tests/storage-port-consumers.test.ts`:
  `ALLOWED` = `loaders/avatar.ts`, `loaders/reviews-write.ts` (Е6д-15: фото відгуку,
  Д-3), `loaders/reviews-edit.ts` (Е6д-23: правка відгуку) і `media-visibility.ts`
  (лише тип `MediaServeVerdict`, Е6д-21). Новий файл у списку — рішення з причиною.
- MIME визначається **магічними байтами** (`sniffImageMime`), не розширенням і не
  `file.type`. Allowlist — png/jpeg/webp/gif/avif; **SVG не приймається** (несе
  скрипти).
- Обʼєкти **іммутабельні**: нове зображення = новий ключ, ключ не перезаписується.
  Саме на цьому тримається `Cache-Control: immutable` роздачі.
- Вітрина резолвить референс **на сервері**, у лоадері чи мапері сутності, щоб
  контракт тем v3 отримував готові URL-рядки.
- Нова медіа-колонка в схемі → запис у `MEDIA_COLUMNS` (`simplycms/domain/media`) +
  резолв при читанні. Гейт — `tests/media-columns-coverage.test.ts`.
- 🔴 Не викликай `supabase.storage` і не імпортуй `@supabase/storage-js`: правило
  `simplycms-storage/no-direct-storage` (`eslint-rules/no-direct-storage.mjs`) і
  ратчет `tests/storage-direct-calls.test.ts` це валять. Виїмок немає: список
  `STORAGE_DIRECT_CALL_EXEMPTIONS` порожній (новий виняток — рішення, а не звичка).
- Не клади URL у колонку сутності — лише референс.
- Не читай `MEDIA_ROOT` і `S3_*` сирим `process.env` — лише `resolveDriverEnv` (порожній `KEY=` від
  Dokploy інакше став би коренем деплою, Р22). Не читай їх і на модуль-рівні — лише в рантаймі, всередині функції
  (контракт серверного env): інстанс драйвера створює `getMediaDriver()` при першому виклику,
  коли `server.mjs` уже наповнив `process.env`.
- Новий драйвер проходить **контрактний набір** `packages/simplycms/test-harness/storage/contract.ts`
  (`runDriverContract`): колізія ключа без перезапису, `delete` відсутнього — успіх, `open`
  відсутнього — `null`, `put`→`open` (ті самі байти, `size` = довжина, два `stream()` — два повних
  стріми), `delete` справді прибирає. Підключення — окремий `*.contract.test.ts` на драйвер;
  `s3` ганяється проти Garage стенду (`pnpm harness:up` пише `S3_*` у `.env.harness`, у CI — крок
  «Garage (S3)» job-а Schema). Без `S3_*` тест s3 **падає** з підказкою, а не skip. Решта `test:schema` (проєкт `pg` у `vitest.schema.config.ts`) свідомо ганяється на `local-fs`: проєкт обнуляє `S3_*`, бо pg-гейти читають диск; драйвер `s3` покриває лише проєкт `storage` (контрактний набір).
  Ключі Garage стенд віддає тільки йому (`harnessServicesEnv`), а не всім споживачам `.env.harness`.
- `<img>` на вітрині: `loading="lazy"` і явні `width`/`height` або `aspect-ratio`.
- Фото відгуку на модерації не публічне: роздача (нижче) віддає його лише автору й
  модератору (Е6д-21), решті — 404. Адмінка показує фото картки через той самий
  `/media` (референси з `getReviewCard` резолвить клієнтський `resolveMediaUrl`, Е6д-11).

## Роздача `/media/<key>` (Е6д-21)

`serveMedia(ctx, { lookup })` (`storage/serve.ts`) не знає про вітрину: маршрут
інʼєктує `lookup`, а той (`storefront/media-visibility.ts`, `lookupMediaForRequest`)
читає рядок `media` за ключем і вирішує видимість власника. Порядок: форма ключа
(`MEDIA_KEY_RE`) → `lookup` → 304 (`If-None-Match`, ПІСЛЯ `lookup`) → `driver.open`.

- Вердикт: `missing` (рядка `media` немає) і `hidden` (глядач не бачить власника) дають
  однаковий 404 `no-store`; 403 підтвердив би існування файлу. Збій `lookup` (БД
  недоступна) — 500 `no-store` з `console.error`, а не «файла немає».
- Видимість — `MEDIA_VISIBILITY` (явна константа за `entity_type`, не реєстр з побічним
  ефектом імпорту): для `review` вона делегована RLS (`product_reviews_select_approved_or_own`),
  модератор бачить усе. Тип без резолвера видимий, якщо рядок є.
- Кеш: публічні файли — `public, max-age=31536000, immutable`; персональні
  (`PERSONAL_MEDIA_ENTITY_TYPES`: аватар, відгук) — `private, no-cache`, тож спільний кеш
  не переживає зміну видимості, а ревалідація (304) знову проходить `lookup`.

## Посилання на медіа й sweep (Е6д-22)

Рядок `media` без посилання з жодної сутності — сирота (скасована форма, збій між
кроками). `findMediaReferences(db, key)` і `mediaReferenceExists(key)`
(`storage/references.ts`) будуються зі спільного набору гілок: кожен запис `MEDIA_COLUMNS`
(`kind: 'text' | 'jsonb'`, `entityType`) плюс поле `logo` у `system_settings['store_profile']`.
Нова медіа-колонка, яку забули в реєстрі, ловить гейт `media-columns-coverage`.

`sweepUnreferencedMedia` (адмінка, налаштування, право `media.write`) стирає сиріт: кандидати
вибираються anti-join у SQL (`created_at` старший за 24 год і `NOT mediaReferenceExists`,
`FOR UPDATE … SKIP LOCKED`), пакетами по 100, до 10 пакетів за виклик; кожен пакет —
окрема транзакція (`eraseMediaRows` з власником рядка) і `completeMediaErasures` після
COMMIT. Гейт `tests/media-sweep-coverage.test.ts` вимагає гілку посилань для кожного
`entity_type`, що є у `MEDIA_COLUMNS` (винятки — `NOT_SWEPT`, зараз порожній).

## Власник рядка `media` обовʼязковий

`media.entity_id` — `NOT NULL`: кожен записувач передає власника, а двофазне
стирання й перевірка видимості при роздачі спираються на нього. Майбутня
медіатека (файл до привʼязки) отримує власного власника — окремий
`entity_type` + фіксований id, як `STORE_LOGO_OWNER_ID`, а не `NULL`. Гейти сідів:
кожен референс демо-сідів має рядок `media` з власником-посилальником.

## Межі

Те, що канон свідомо не закриває:

1. БД недоступна саме в момент відкату публікації → файл без рядка `media` і без хвоста
   outbox. Роздача його не віддає (немає рядка), місце на диску звільнить лише оператор.
2. Ручна вставка `/media/<key>` у rich HTML (опис товару тощо) власності не створює:
   посилання в HTML не входить до `findMediaReferences`, тож sweep може стерти такий
   файл, якщо його рядок `media` без посилання з колонок.
3. Прямий виклик serverFn повз UI, що перевищує стелю тіла, може побачити обрив
   зʼєднання замість 413 (`UPSTREAM:START-BODY-1`).
4. Chunked JSON обмежує лічильник байтів Node-раннера (1 МіБ, Р20); під іншим
   рантаймом без такого лічильника вікно відкрите (`upstream-workarounds.md`, START-BODY-1).
5. **Колізія ключа в `s3` — best-effort** (`UPSTREAM:GARAGE-INM-1`). Garage ігнорує
   `If-None-Match: *`, тож `put` спершу робить `HEAD` (`200` → `MediaKeyCollisionError`) і лише
   потім `PUT`. Між ними інша публікація того ж ключа проскочить; ключ — свіжий UUID викликача,
   тож гонка можлива лише при повторному використанні ключа. `local-fs` гарантує виключність
   атомарно (`link`).
6. **Збій драйвера при роздачі — 503, не 404** (Е8-Р14). `serveMedia` мапить `null` з
   `driver.open` у 404 (файла немає), а ВИНЯТОК (мережа S3, права диска) — у 503 `no-store` з
   одним `console.error` (ключ, імʼя/код помилки і її повідомлення, де облікові дані URL `scheme://user:pass@` замасковано повністю — `describeDriverError`). 404 на збій закешували б
   CDN і браузер, і оператор не побачив би причини. Дійсне для обох драйверів.

## Логотип магазину — референс у jsonb (Е6б-14)

Логотип лежить не в колонці, а в полі `logo` jsonb-значення
`system_settings['store_profile']` (рядок `media` — `entity_type = 'store_logo'`,
`entity_id = STORE_LOGO_OWNER_ID`). 🔴 Гейт `media-columns-coverage` такого посилання
**не бачить**: він звіряє колонки зі схеми, а не поля всередині jsonb. Тому гілка логотипа
окремо вписана у `findMediaReferences`/sweep, а інваріанти логотипа тримає сама операція `saveStoreProfileOp` (`admin-server/impl/settings/save-profile.ts`)
і її харнес, а не гейт:

- новий `logo` — або `null`, або `media.storage_key` з `entity_type = 'store_logo'` і
  `entity_id = STORE_LOGO_OWNER_ID` (`select … for share`); зовнішній URL чи чужий
  референс → 409 `store_logo_invalid`;
- старий логотип при заміні чи прибиранні двофазно стирається: `eraseMediaRows` (власник
  `store_logo/STORE_LOGO_OWNER_ID`) останнім кроком транзакції, файл —
  `completeMediaErasures` після COMMIT; лок `store-profile` першим запитом не дає двом
  паралельним збереженням лишити сироту (Е6б-24);
- `ImageUpload` файл при прибиранні з форми не стирає — скасована форма чи відмова
  сервера лишають старий логотип цілим.

🔴 Чесна межа: `ImageUpload` пише НОВИЙ файл і рядок `media` одразу під час
завантаження. «Завантажив новий логотип → скасував форму» лишає рядок `store_logo` і
файл, на які профіль не посилається, — сирота, якого змете sweep (Е6д-22) через 24 год.
Те саме з файлами, які живий прогін лишає в `MEDIA_ROOT` стенда після SQL-відновлення знімка.

Живий доказ порту — `pnpm live:smoke` (аватар: завантаження, роздача `/media`,
референс у БД, видалення; логотип: заміна лишає рівно один `store_logo`, старий файл
віддає 404; контент Е6д: заміна картинки банера лишає рівно один рядок `media`
банера, старий файл 404; відгук із фото — рядок `media` сутності `review`, картка
адмінки віддає фото 200). Код — `packages/simplycms/src/storage/`; драйвер, запис і
роздача — окремі модулі (`local-fs.ts`, `record.ts`, `serve.ts`).
