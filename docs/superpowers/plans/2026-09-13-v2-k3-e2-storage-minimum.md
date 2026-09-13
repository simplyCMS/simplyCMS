# V2-К3 · Етап Е2: storage-мінімум — порт медіа, драйвер `local-fs`, живий аватар

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дати платформі власний канал роботи з файлами — server-only піддерево `simplycms/storage` (драйвер `local-fs`, іммутабельні ключі, MIME за магічними байтами), запис метаданих у `media` в одній транзакції з файлом, роздачу через роут ядра — і довести його наскрізь ЖИВИМ споживачем (аватар покупця), а не лише тестами.

**Architecture:** У БД лягає **медіа-референс**, а не URL: рядок каже, *що* це за зображення, а не *звідки* його роздають. Резолв у URL — одна чиста функція `resolveMediaUrl` (T1), яку вітрина кличе на сервері при побудові view-model-ів, тож контракт тем v3 не змінюється. Запис і видалення — серверні операції: `writeMedia`/`eraseMedia` приймають готову транзакцію актора (`ActorDb`) і драйвер, тож і адмінка (`app_admin` через `admin-server`), і вітрина (`app_user` через `withSessionDb`) ходять одним кодом під різними ролями. Драйвер ізольовано інтерфейсом `MediaStorageDriver` (`put`/`delete`/`open`) — `s3` у К4 стає його другою реалізацією, а не іншим транспортом.

**Tech Stack:** Node `>=22.12` (`node:fs/promises`, `node:crypto`, `Readable.toWeb`) · TanStack Start 1.167 (serverFn з `FormData`; splat-роут `server.handlers.GET`) · Drizzle 0.45.2 · Zod 4.4.3 · TypeScript 5.9 strict · Vitest 4

**Spec:** [`2026-08-29-v2-k3-admin-server-layer-design.md`](../specs/2026-08-29-v2-k3-admin-server-layer-design.md) §К3-12 (скоуп storage-мінімуму) + [`2026-08-19-backend-contract-v2-design.md`](../specs/2026-08-19-backend-contract-v2-design.md) §4-К4 (три інваріанти порту) і B4 (контракт драйверів). Розвилки, яких спеки не закривають, вирішені архітектором рішення (сесія `simplycms-e1`, 2026-09-13) — рішення процитовані в «Ухвалених рішеннях» нижче, кожне з причиною.

---

## Ухвалені рішення етапу (джерело — архітектор, 2026-09-13)

| № | Рішення | Причина |
|---|---|---|
| Е2-1 | **У БД — референс, не URL.** Референс = storage key завантаженого файлу; `https?:`/`data:`/`blob:`/`/…` проходять як є | Рядок зберігає, *що* це за зображення, а не *звідки* роздають. Зовнішньо хостовані картинки й плейсхолдери сіду — постійний випадок, не перехідний |
| Е2-2 | **Транспорт — serverFn із `FormData`**, драйвер за server-only портом | Authz і «розмір у тій самій транзакції» — серверні обовʼязки, які serverFn уже має. Presigned direct-to-S3 у К4 — **адитивний** другий шлях (`signPut` + `prepare`/`finalize`), не заміна цього |
| Е2-3 | **Роздача — роут Start, не другий `sirv`-маунт** | Один кодовий шлях у dev, prod, пілоті й `live:smoke`. Швидкість дають іммутабельні ключі (`max-age=31536000, immutable`), а не обхід Node; CDN попереду — К2 |
| Е2-4 | **`MEDIA_ROOT` — четвертий, ОПЦІЙНИЙ ключ env** із дефолтом `./.data/media` | Хмара (том Dokploy) і будь-який хостинг мусять мати змогу вказати змонтований том без симлінк-хаків. Форма — як `BETTER_AUTH_URL`: коментар у `.env.example`, поза `REQUIRED_ENV_VARS` доктора |
| Е2-5 | **Одна нова операція `media.write`** (upload + delete), `{ admin: 'any' }` | Не `catalog.write`: банери, розділи й відгуки — не каталог. Не дві операції: завантажити й прибрати власне завантаження — один акт. Аватар покупця їде під наявним `profile.update` (scope `own`) |
| Е2-6 | **Аватар — В Е2, як перший ЖИВИЙ споживач порту** | Усі пʼять сторінок із `ImageUpload` сидять на мертвому `supabase-js` до хвиль Е3–Е6, тож «зображення товару працює» в Е2 недоказове **за побудовою**. Єдина жива сторінка з картинкою — кабінет покупця |
| Е2-7 | **Порядок видалення: СПЕРШУ обʼєкт, ПОТІМ рядок**; `unlink` з `ENOENT` = успіх | Цей порядок лишає облік у безпечному напрямку (рядок переоцінює обсяг, а не занижує), а ідемпотентний `unlink` робить повтор після невдалого видалення рядка коректним |
| Е2-8 | **Ключ ніколи не перезаписується**; запис через тимчасовий файл + атомарна публікація | Частково записаний файл не стає видимим роуту роздачі; колізія ключа падає, а не мовчки перезаписує чужий обʼєкт |
| Е2-9 | **`ReviewDetail.tsx` не чіпаємо**; лінт-заборона прямих storage-викликів — ратчетом зі списком виїмок | Сторінка мертва й переписується хвилею відгуків цілком. Ратчет не дає Е3–Е6 завести НОВИЙ прямий виклик |
| Е2-10 | **SVG заборонений на upload**; MIME — за магічними байтами | SVG несе скрипти. Це рядок валідатора, а не «потім». Allowlist Е2: png/jpeg/webp/gif/avif |

**Другий інваріант §4-К4 роботи в Е2 не потребує — і це перевірено, а не
припущено.** Незмінність колонок власності (`entity_type`/`entity_id`/
`storage_key`/`uploaded_by`) уже тримається **відсутністю гранта `UPDATE`** у
`app_user` (`0002_grants.sql:120`), а не тригером, і вже стоїть під
поведінковим гейтом `test-harness/pg/__tests__/rls-behaviour.test.ts:210`
(«перепривʼязка відбита, читання й завантаження — ні»). Тому в плані немає
задачі під цей інваріант: додавати до нього щось означало б дублювати
захист, який уже червоніє при зламі.

**Поза Е2 (це К4, і план це каже вголос):** драйвер `s3`, `transform`/srcset, presigned direct-upload, облік НЕВДАЛИХ видалень і sweep орфанів, привʼязка `entity_id` для файлів, завантажених до збереження сутності (медіатека).

🔴 **Орфани Е2 названі поіменно** — їх рівно два класи, обидва нешкідливі для
покупця й обидва прибирає sweep К4: (1) обʼєкт, записаний успішно, але
транзакція впала на COMMIT — файл без рядка `media`, тобто облік НЕ рахує
байти, яких ніхто не адресує; (2) сирота `.tmp-*` після падіння процесу між
`link` і `unlink` — імʼя поза `MEDIA_KEY_RE`, тож роздача її не віддасть
ніколи. Третього класу немає: рядок без обʼєкта самолікується повтором
видалення (`unlink` з `ENOENT` — успіх).

**Що Е2 чесно НЕ доводить:** «завантаження й видалення зображення товару працює» (DoD К3 п.6). `ImageUpload` переписується на порт тут і покривається юнітами, але його пʼять сторінок-споживачів лишаються на `supabase-js` до Е3–Е6 — живого доказу на товарі в Е2 бути не може. DoD К3 п.6 закривається хвилею каталогу.

---

## Global Constraints

- TypeScript 5.9 strict; **не** оновлювати до 6/7.
- Node `>=22.12` — поріг усіх пʼяти пакетів; нових порогів не заводити.
- Коментарі й документація — **українською**; рядки інтерфейсу — тільки через i18n-каталоги (`uk` + `en`, обидва).
- `pnpm lint` = **0 errors**. Кількість warnings НЕ асертиться: перед Task 1 виміряти `pnpm lint`, зафіксувати число в DoD-звіті — воно не має зрости.
- Порядок гейтів: `pnpm install --frozen-lockfile → format:check → lint → build → typecheck → test → test:schema → build:packages → typecheck:template → test:packaging`.
- `install --frozen-lockfile` — **перший** і не пропускається після будь-якої правки `package.json`.
- 🔴 **Мінімальний гейт КОЖНОЇ задачі перед комітом: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`** (+ `pnpm test:schema`, якщо задача чіпала `schema/`, `migrations/` або `test-harness/`). Саме ці чотири — урок К2-Е0 (рішення K): `typecheck` ловить те, чого не бачить `lint`, а гейт — саме `format:check`, бо `pnpm format` це `prettier --write`, який не червоніє.
- 🔴 **Рев'ю кожної задачі перевіряє, ЯКИЙ файл правили.** Імплементер, що працює з витягнутою копією брифа, може виправити копію, а не сам план — у К2-Е0 (Task 11) це виявилось аж на фінальному рев'ю. Перевірка дешева: `grep` спірного рядка по САМОМУ файлу плану, не по тексту в контексті.
- 🔴 **К3-4′:** `createServerFn` — ЛИШЕ топ-рівневий `const` з простим ідентифікатором.
- 🔴 **К3-9′:** модуль із serverFn експортує лише serverFn (для `admin-server/index.ts`); операції/схеми — server-side; клієнт бере type-only типи.
- 🔴 **К3-13:** порядок у кожній адмін-операції — `requireGrant(op)` → `withActor({ role: dbRoleForSubject(subject) })`. 403 — `setResponseStatus(403)` **ДО** `throw`; `Response` не кидати.
- 🔴 **Контракт id (К3-Е0):** `media.id` генерує ВИКЛИКАЧ (`randomUUID()` на сервері) — `DEFAULT` на таблиці немає, забутий `id` дає `23502`. Гейт `explicit-ids` дискаверить усі вставки в `packages/simplycms/src/**`.
- 🔴 **Ключі кешу:** перший сегмент `queryKey` — лише з `simplycms/contracts/entities` (`ENTITY`/`AGGREGATE`/`SESSION_KEY`).
- 🔴 **Тіри:** нове піддерево `storage` = **T2** з upward-винятком `['db']` (як `auth`, `storefront`, `admin-server` — єдиний канал до Postgres це `withActor`); `domain/media.ts` = **T1** (чистий, без IO).
- 🔴 **Інваріант `template:sync`:** задача, що чіпає `SYNCED_FILES`/`SYNCED_DIRS` (`scripts/sync-create-store-template.mjs:43,62`), зобовʼязана прогнати `pnpm template:sync` і закомітити копію. **Увага:** `.env.example` і `.gitignore` кореня в цих списках **НЕМАЄ** — їхні шаблонні відповідники (`packages/create-simplycms-store/template/env.example`, `template/gitignore`) правляться руками, і це окремий крок у Task 2.
- 🔴 **Межа клієнт/сервер:** нове server-only піддерево додається в `SERVER_ONLY` (`contracts/server-only.ts`) ОДИН раз — усі шість читачів підхоплюють його самі; але `tests/dist-server-boundary.test.ts` тримає окрему мапу `SENTINELS`, яка **навмисно не похідна** від списку, тож червонітиме, доки не додаси літерал. Це гейт у дії, а не поломка.
- Коміти українською, без attribution-рядків.

## Передумова оточення

```bash
export PG_HARNESS_URL='postgresql://pgtest@127.0.0.1:55433/postgres'
node -e "const pg=require('pg');const c=new pg.Client({connectionString:process.env.PG_HARNESS_URL});c.connect().then(()=>c.query('select 1')).then(()=>{console.log('OK');return c.end()}).catch(e=>{console.error('FAIL',e.message);process.exit(1)})"
```

🔴 Порт `55433` вище — **знімок конкретного стенда, а не контракт**: харнес бере будь-який кластер із `PG_HARNESS_URL`, а без нього підіймає ефемерний `initdb`/`pg_ctl` сам. Підстав свій.

🔴 Тести з `test-harness/**` — **тільки** через `pnpm vitest run --config vitest.schema.config.ts <path>`; кореневий конфіг цю теку виключає.

## Граф залежностей задач

```
Task 1 (resolveMediaUrl + порт T0 + реєстр колонок) ─┬─► Task 5 (аватар наскрізь)
Task 2 (storage: env/ключі/MIME/драйвер + межа)     ─┤   ▲
        └─► Task 3 (record.ts: файл+рядок) ──────────┼───┘
        └─► Task 4 (роут /media/$) ──────────────────┘
Task 1 ─────────────────────────────────► Task 6 (резолв решти вітрини)
Task 3 ─► Task 7 (media.write + admin serverFn + ImageUpload) ─► Task 8 (лінт-ратчет)
Task 5, 6, 7, 8 ─► Task 9 (live:smoke + доки + DoD)
```

## File Structure

**Створюються:**

| Файл | Відповідальність |
|---|---|
| `packages/simplycms/src/domain/media.ts` | T1, чистий: `MediaRef`, `MEDIA_URL_BASE`, `resolveMediaUrl`, `resolveMediaUrls`, реєстр `MEDIA_COLUMNS` |
| `packages/simplycms/src/domain/__tests__/media.test.ts` | Юніти трьох форм референсу + нормалізація бази |
| `packages/simplycms/src/schema/__tests__/media-columns-coverage.test.ts` | Гейт: кожна медіа-колонка схеми є в `MEDIA_COLUMNS` |
| `packages/simplycms/src/storage/index.ts` | Барель server-only піддерева (експорт публічної поверхні) |
| `packages/simplycms/src/storage/env.ts` | `mediaRoot()` — `process.env.MEDIA_ROOT` у рантаймі, дефолт `./.data/media` |
| `packages/simplycms/src/storage/keys.ts` | `MediaMime`, `mediaKey()` (шардинг `ab/<uuid>.<ext>`), `MEDIA_KEY_RE` |
| `packages/simplycms/src/storage/mime.ts` | `sniffImageMime()` — MIME за магічними байтами, allowlist без SVG |
| `packages/simplycms/src/storage/driver.ts` | Інтерфейс `MediaStorageDriver` + `MediaObject` + класи помилок |
| `packages/simplycms/src/storage/local-fs.ts` | Драйвер диска: `put` (tmp + `link`), `delete` (ідемпотентний), `open` (стрім) |
| `packages/simplycms/src/storage/record.ts` | `writeMedia`/`eraseMedia` — файл і рядок `media` в одній транзакції актора |
| `packages/simplycms/src/storage/serve.ts` | `serveMedia(request)` — хендлер роздачі (traversal-гард, заголовки, 404) |
| `packages/simplycms/src/storage/__tests__/keys.test.ts` | Юніти шардингу й регексу ключа |
| `packages/simplycms/src/storage/__tests__/mime.test.ts` | Юніти сніфера (5 дозволених + SVG + сміття) |
| `packages/simplycms/src/storage/__tests__/local-fs.test.ts` | Юніти драйвера на `mkdtemp` (wx-колізія, ENOENT-ідемпотентність, traversal) |
| `packages/simplycms/src/storage/__tests__/serve.test.ts` | Юніти роздачі (traversal → 404, `nosniff`, `Content-Type` з рядка) |
| `packages/simplycms/test-harness/pg/__tests__/media-record.test.ts` | Харнес PG: `writeMedia`/`eraseMedia` проти живої БД, відкат при падінні запису |
| `packages/simplycms/routes/storefront/media/$.tsx` | Роут `/media/$` — єдиний export `Route` |
| `packages/simplycms/src/core/lib/profile-avatar.ts` | T5 serverFn кабінету: `uploadMyAvatar(FormData)` / `removeMyAvatar()` |
| `packages/simplycms/src/profile-ui/__tests__/avatar-upload.test.tsx` | Юніти живого `AvatarUpload` (замість `avatar-upload-disabled.test.tsx`) |
| `packages/simplycms/src/admin-server/impl/operations/media.ts` | `uploadMediaOp`/`deleteMediaOp` — authz + транзакція `app_admin` |
| `packages/simplycms/src/admin-server/impl/__tests__/media.test.ts` | Юніти операцій (валідація FormData, 403 без гранта) |
| `eslint-rules/no-direct-storage.mjs` | Шосте власне правило: прямий виклик сховища поза портом |
| `tests/eslint-rules/no-direct-storage.test.ts` | Машинні фікстури правила (Linter API) |
| `tests/storage-direct-calls.test.ts` | Ратчет: прямі storage-виклики поза портом — список виїмок може лише скорочуватись |
| `scripts/live-smoke/avatar.mjs` | Крок аватара живого прогону (окремим модулем — канон 150 рядків `funnel.mjs`) |

**Змінюються:**

| Файл | Що саме |
|---|---|
| `packages/simplycms/src/contracts/ports/index.ts` | `MediaProvider` звужується до `{ url(ref: string): string \| null }` — `upload` зникає (пішов у serverFn) |
| `packages/simplycms/src/contracts/server-only.ts` | `SERVER_ONLY` += `'storage'` |
| `tests/dist-server-boundary.test.ts` | `SENTINELS` += літерал для `storage` |
| `eslint.tier-zones.mjs` | Зона `['src/storage', 2, 'storage', ['db']]` (Task 2) + `storage` в upward-виняток `admin-server` (Task 7) |
| `eslint.config.mjs` | Зона заборони прямих storage-викликів (Task 8) |
| `packages/simplycms/package.json` | `exports` + `publishConfig.exports`: `./domain/media`, `./storage` |
| `.env.example`, `packages/create-simplycms-store/template/env.example` | Закоментований `MEDIA_ROOT` із поясненням |
| `.gitignore`, `packages/create-simplycms-store/template/gitignore` | `.data/` |
| `tests/env-contract.test.ts` | Третя множина — опційні ключі `{BETTER_AUTH_URL, MEDIA_ROOT}` |
| `packages/simplycms/src/auth/authz.ts` | `Operation` += `'media.write'`; `AUTHZ_MATRIX` += `{ admin: 'any' }` |
| `packages/simplycms/src/admin-server/index.ts` | Топ-рівневі `uploadMedia` / `deleteMedia` |
| `packages/simplycms/src/admin-server/impl/index.ts` | Реекспорт операцій медіа |
| `packages/simplycms/src/admin/components/ImageUpload.tsx` | `supabase.storage` → serverFn порту; форма тримає референси |
| `packages/simplycms/src/profile-ui/AvatarUpload.tsx` | Відмова → живий upload/remove |
| `packages/simplycms/src/storefront-routes/pages/ProfileSettings.tsx` | Проп `userId` зникає; `onUpdate` під новий контракт |
| `packages/simplycms/src/storefront/loaders/profile.ts` | `loadProfile` резолвить `avatar_url` |
| `packages/simplycms/src/storefront/loaders/entities/product.ts` | `toImageList` резолвить кожен елемент |
| `packages/simplycms/src/storefront/loaders/entities/banner.ts` | `toBanner` резолвить три колонки |
| `packages/simplycms/src/storefront/loaders/entities/section.ts` | `toSectionRow` — новий мапер із резолвом |
| `packages/simplycms/src/storefront/loaders/entities/property.ts` | `toOptionRow` — новий мапер із резолвом |
| `packages/simplycms/src/storefront/loaders/sections.ts`, `properties.ts`, `property-option.ts` | Пропускають рядки через нові мапери |
| `packages/simplycms/src/storefront/loaders/reviews.ts` | `images` — через `toImageList` |
| `packages/simplycms/src/i18n/catalogs/{uk,en}/profile.ts` | `profile.avatar.*` — вісім ключів замість `unavailable` |
| `scripts/live-smoke/funnel.mjs`, `scripts/live-smoke.mjs` | Крок аватара |
| `.github/instructions/storage.instructions.md` | Переписати під порт (зараз описує Supabase Storage) |
| `CLAUDE.md`, `docs/tasks/platform-roadmap.md`, `docs/tasks/v2-state-map.md`, `docs/architecture/test-contours.md` | Стан після Е2 |

**Видаляються:**

| Файл | Причина |
|---|---|
| `packages/simplycms/src/profile-ui/__tests__/avatar-upload-disabled.test.tsx` | Асертить `disabled` на інпуті — рівно те, що етап знімає; замінюється `avatar-upload.test.tsx` |

---

## Task 1: Медіа-референс — чиста функція резолву, порт T0 і реєстр колонок

**Files:**
- Create: `packages/simplycms/src/domain/media.ts`
- Create: `packages/simplycms/src/domain/__tests__/media.test.ts`
- Create: `packages/simplycms/src/schema/__tests__/media-columns-coverage.test.ts`
- Modify: `packages/simplycms/src/contracts/ports/index.ts:76-79`
- Modify: `packages/simplycms/package.json` (`exports` + `publishConfig.exports`)

**Interfaces:**
- Consumes: нічого (перша задача).
- Produces:
  - `export type MediaRef = string`
  - `export const MEDIA_URL_BASE = '/media'`
  - `export function resolveMediaUrl(ref: string | null | undefined, base?: string): string | null`
  - `export function resolveMediaUrls(refs: readonly string[], base?: string): string[]`
  - `export const MEDIA_COLUMNS: readonly { table: string; column: string }[]`
  - `MediaProvider` у T0 = `{ url(ref: string): string | null }`

- [ ] **Step 1: Написати падаючий тест резолву**

`packages/simplycms/src/domain/__tests__/media.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MEDIA_URL_BASE, resolveMediaUrl, resolveMediaUrls } from '../media';

describe('resolveMediaUrl', () => {
  it('storage key → URL під базою', () => {
    expect(resolveMediaUrl('ab/ab000000-0000-4000-8000-000000000000.png')).toBe(
      '/media/ab/ab000000-0000-4000-8000-000000000000.png',
    );
  });

  it('абсолютний http(s) лишається як є', () => {
    expect(resolveMediaUrl('https://cdn.example.com/a.jpg')).toBe(
      'https://cdn.example.com/a.jpg',
    );
    expect(resolveMediaUrl('http://example.com/a.jpg')).toBe(
      'http://example.com/a.jpg',
    );
  });

  it('data: і blob: лишаються як є — плейсхолдери сіду й локальні прев’ю', () => {
    const svg = 'data:image/svg+xml;charset=utf-8,<svg/>';
    expect(resolveMediaUrl(svg)).toBe(svg);
    expect(resolveMediaUrl('blob:http://localhost/x')).toBe(
      'blob:http://localhost/x',
    );
  });

  it('корене-відносний шлях лишається як є', () => {
    expect(resolveMediaUrl('/static/logo.svg')).toBe('/static/logo.svg');
  });

  it('порожнє, пробіли, null і undefined → null', () => {
    expect(resolveMediaUrl(null)).toBeNull();
    expect(resolveMediaUrl(undefined)).toBeNull();
    expect(resolveMediaUrl('')).toBeNull();
    expect(resolveMediaUrl('   ')).toBeNull();
  });

  it('база без хвостового слеша — кінцевий URL без подвійного', () => {
    expect(resolveMediaUrl('ab/x.png', '/cdn/')).toBe('/cdn/ab/x.png');
    expect(resolveMediaUrl('ab/x.png', '/cdn')).toBe('/cdn/ab/x.png');
  });

  it('база за замовчуванням — MEDIA_URL_BASE', () => {
    expect(MEDIA_URL_BASE).toBe('/media');
    expect(resolveMediaUrl('ab/x.png')).toBe(`${MEDIA_URL_BASE}/ab/x.png`);
  });

  it('resolveMediaUrls викидає елементи, що резолвляться в null', () => {
    expect(resolveMediaUrls(['ab/x.png', '', '  ', 'https://e.com/y.jpg'])).toEqual([
      '/media/ab/x.png',
      'https://e.com/y.jpg',
    ]);
  });
});
```

- [ ] **Step 2: Прогнати — має впасти**

Run: `pnpm vitest run packages/simplycms/src/domain/__tests__/media.test.ts`
Expected: FAIL — `Failed to resolve import "../media"`.

- [ ] **Step 3: Написати `domain/media.ts`**

```ts
// Медіа-референс і його резолв у URL — тір T1, без IO.
//
// 🔴 У БД лежить РЕФЕРЕНС, а не URL (рішення Е2-1): рядок каже, ЩО це за
// зображення, а не ЗВІДКИ його роздають. Інакше зміна драйвера сховища
// вимагала б переписати всі збережені рядки, а зовнішньо хостовані картинки
// й плейсхолдери сіду не мали б куди подітись.
//
// 🔴 Функція чиста й живе в T1 саме тому, що її кличуть з обох боків межі:
// серверні лоадери вітрини (побудова view-model-ів) і — у К4, коли зʼявиться
// `transform` — клієнтський порт. Модуль із `node:fs` цього не витримав би.

/** Референс на зображення: storage key АБО зовнішній/вбудований URL. */
export type MediaRef = string;

/** База URL роздачі драйвера `local-fs` (роут `/media/$`, Task 4). */
export const MEDIA_URL_BASE = '/media';

// Форми, які вже Є адресою й не потребують бази. `blob:` — локальне прев’ю,
// яке браузер створює до завантаження; воно ніколи не доходить до БД, але
// проходить через ту саму функцію в рендері форми.
const ALREADY_ABSOLUTE = /^(?:https?:|data:|blob:|\/)/i;

/**
 * Референс → URL. `null` означає «зображення немає» — саме так, а не
 * порожній рядок: `<img src="">` перезавантажує поточну сторінку.
 */
export function resolveMediaUrl(
  ref: string | null | undefined,
  base: string = MEDIA_URL_BASE,
): string | null {
  if (ref === null || ref === undefined) return null;
  const trimmed = ref.trim();
  if (trimmed === '') return null;
  if (ALREADY_ABSOLUTE.test(trimmed)) return trimmed;
  return `${base.replace(/\/+$/, '')}/${trimmed}`;
}

/** Те саме для масиву; елементи, що дали `null`, викидаються. */
export function resolveMediaUrls(
  refs: readonly string[],
  base: string = MEDIA_URL_BASE,
): string[] {
  const out: string[] = [];
  for (const ref of refs) {
    const url = resolveMediaUrl(ref, base);
    if (url !== null) out.push(url);
  }
  return out;
}

/**
 * Колонки схеми, що несуть медіа-референс.
 *
 * 🔴 Реєстр існує заради ГЕЙТА, а не заради коду: нова медіа-колонка,
 * додана в схему без резолву на вітрині, показала б покупцеві голий
 * storage key замість картинки — і виявилось би це аж на живому магазині.
 * Тест `schema/__tests__/media-columns-coverage.test.ts` звіряє цей список
 * зі схемою; Task 6 доводить, що кожен запис резолвиться при читанні.
 */
export const MEDIA_COLUMNS = [
  { table: 'products', column: 'images' },
  { table: 'product_modifications', column: 'images' },
  { table: 'product_reviews', column: 'images' },
  { table: 'banners', column: 'image_url' },
  { table: 'banners', column: 'desktop_image_url' },
  { table: 'banners', column: 'mobile_image_url' },
  { table: 'sections', column: 'image_url' },
  { table: 'property_options', column: 'image_url' },
  { table: 'profiles', column: 'avatar_url' },
] as const satisfies readonly { table: string; column: string }[];
```

- [ ] **Step 4: Прогнати — має пройти**

Run: `pnpm vitest run packages/simplycms/src/domain/__tests__/media.test.ts`
Expected: PASS (8 тестів).

- [ ] **Step 5: Написати падаючий гейт покриття колонок**

`packages/simplycms/src/schema/__tests__/media-columns-coverage.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getTableColumns, getTableName, is, Table } from 'drizzle-orm';
import { MEDIA_COLUMNS } from 'simplycms/domain/media';
import * as schema from '../schema';

/**
 * Нова медіа-колонка в схемі мусить зʼявитись і в реєстрі `MEDIA_COLUMNS`.
 *
 * 🔴 Евристика навмисно ШИРША за реєстр: усе, що зветься `image*`, `*_image*`,
 * `avatar*` або `images`. Хибне спрацювання лікується одним рядком у реєстрі
 * (або в `NOT_MEDIA` нижче з причиною) — пропущена колонка коштувала б
 * зламаної картинки на живій вітрині.
 */
const LOOKS_LIKE_MEDIA = /^(images|avatar_url|.*image_url|image)$/;

/** Колонки, що збігаються з евристикою, але медіа НЕ несуть. */
const NOT_MEDIA: readonly string[] = [];

describe('реєстр медіа-колонок', () => {
  const found: string[] = [];
  for (const value of Object.values(schema)) {
    if (!is(value, Table)) continue;
    const table = getTableName(value);
    for (const column of Object.values(getTableColumns(value))) {
      if (LOOKS_LIKE_MEDIA.test(column.name)) found.push(`${table}.${column.name}`);
    }
  }

  it('кожна медіа-колонка схеми є в MEDIA_COLUMNS', () => {
    const registered = new Set(
      MEDIA_COLUMNS.map((c) => `${c.table}.${c.column}`),
    );
    const missing = found
      .filter((key) => !registered.has(key))
      .filter((key) => !NOT_MEDIA.includes(key));
    expect(missing, 'додай у MEDIA_COLUMNS або в NOT_MEDIA з причиною').toEqual(
      [],
    );
  });

  it('у MEDIA_COLUMNS немає записів без колонки в схемі', () => {
    const actual = new Set(found);
    const stale = MEDIA_COLUMNS.map((c) => `${c.table}.${c.column}`).filter(
      (key) => !actual.has(key),
    );
    expect(stale, 'колонку перейменували або прибрали').toEqual([]);
  });
});
```

- [ ] **Step 6: Прогнати гейт — він мусить бути ЗЕЛЕНИМ одразу**

Run: `pnpm vitest run packages/simplycms/src/schema/__tests__/media-columns-coverage.test.ts`
Expected: PASS. Якщо перший тест червоний — евристика знайшла колонку, якої немає в реєстрі: **не підганяй регекс**, додай колонку в `MEDIA_COLUMNS` і в Task 6 (резолв при читанні). Якщо червоний другий — звір імена з `schema.ts`.

- [ ] **Step 7: Негативний контроль гейта (прогнати руками, не комітити)**

Тимчасово закоментуй рядок `{ table: 'sections', column: 'image_url' },` у `MEDIA_COLUMNS` і прожени той самий тест.
Expected: FAIL із `missing` = `['sections.image_url']`. Поверни рядок.

- [ ] **Step 8: Звузити `MediaProvider` у T0**

У `packages/simplycms/src/contracts/ports/index.ts` замінити блок

```ts
export interface MediaProvider {
  url(path: string, opts?: ImageOpts): string;
  upload(file: File): Promise<string>;
}
```

на

```ts
/**
 * Резолв медіа-референсу в URL — єдине, що потрібно КЛІЄНТУ (рішення Е2-1).
 *
 * 🔴 `upload` звідси пішов у V2: завантаження — серверна операція (serverFn),
 * бо тільки сервер може перевірити грант і записати `size_bytes` у ту саму
 * транзакцію, що й файл. Клієнтський порт із `upload(file)` обіцяв би
 * контракт, якого браузер виконати не може.
 *
 * 🔴 Серверний драйвер сховища — ОКРЕМИЙ інтерфейс `MediaStorageDriver`
 * у `simplycms/storage`: T0 не має рантайм-залежностей і не може нести
 * `node:fs`-семантику.
 *
 * Реалізація — `resolveMediaUrl` із `simplycms/domain/media`, прибінджена до
 * бази драйвера. `opts` зарезервовано під `transform` (К4).
 */
export interface MediaProvider {
  url(ref: string, opts?: ImageOpts): string | null;
}
```

- [ ] **Step 9: Додати субшлях `./domain/media` в exports**

У `packages/simplycms/package.json` — у `exports` (алфавітно поруч з іншими `./domain/*`):

```json
"./domain/media": "./src/domain/media.ts",
```

і в `publishConfig.exports`:

```json
"./domain/media": { "types": "./dist/domain/media.d.ts", "import": "./dist/domain/media.js" },
```

- [ ] **Step 10: Гейт задачі**

```bash
pnpm install --frozen-lockfile
pnpm lint && pnpm typecheck && pnpm test
```
Expected: PASS. 🔴 `install --frozen-lockfile` тут обовʼязковий — `package.json` змінено.

- [ ] **Step 11: Коміт**

```bash
git add packages/simplycms/src/domain/media.ts \
        packages/simplycms/src/domain/__tests__/media.test.ts \
        packages/simplycms/src/schema/__tests__/media-columns-coverage.test.ts \
        packages/simplycms/src/contracts/ports/index.ts \
        packages/simplycms/package.json
git commit -m "feat(k3-e2): медіа-референс — resolveMediaUrl у T1, реєстр колонок і звужений MediaProvider"
```

---

## Task 2: Піддерево `simplycms/storage` — env, ключі, MIME, драйвер `local-fs`

**Files:**
- Create: `packages/simplycms/src/storage/env.ts`, `keys.ts`, `mime.ts`, `driver.ts`, `local-fs.ts`, `index.ts`
- Create: `packages/simplycms/src/storage/__tests__/keys.test.ts`, `mime.test.ts`, `local-fs.test.ts`
- Modify: `packages/simplycms/src/contracts/server-only.ts:37-46`
- Modify: `tests/dist-server-boundary.test.ts` (`SENTINELS`, ~рядок 170)
- Modify: `eslint.tier-zones.mjs` (масив `TIER_ZONES`)
- Modify: `packages/simplycms/package.json` (`exports` + `publishConfig.exports`)
- Modify: `.env.example`, `packages/create-simplycms-store/template/env.example`
- Modify: `.gitignore`, `packages/create-simplycms-store/template/gitignore`
- Modify: `tests/env-contract.test.ts`

**Interfaces:**
- Consumes: нічого з Task 1 (незалежна).
- Produces:
  - `export type MediaMime = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' | 'image/avif'`
  - `export function mediaKey(mime: MediaMime): string`
  - `export const MEDIA_KEY_RE: RegExp`
  - `export function sniffImageMime(bytes: Uint8Array): MediaMime | null`
  - `export function mediaRoot(): string`
  - `export interface MediaObject { readonly size: number; stream(): ReadableStream<Uint8Array> }`
  - `export interface MediaStorageDriver { put(key, bytes): Promise<void>; delete(key): Promise<void>; open(key): Promise<MediaObject | null> }`
  - `export class MediaKeyError extends Error`, `export class MediaKeyCollisionError extends Error`
  - `export function localFsDriver(root?: string): MediaStorageDriver`
  - `export function getMediaDriver(): MediaStorageDriver` (мемоізований дефолт)

- [ ] **Step 1: Написати падаючі тести ключів**

`packages/simplycms/src/storage/__tests__/keys.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MEDIA_KEY_RE, mediaKey } from '../keys';

describe('mediaKey', () => {
  it('форма — <2 hex>/<uuid>.<ext>, шард дорівнює першим двом символам uuid', () => {
    const key = mediaKey('image/png');
    expect(key).toMatch(MEDIA_KEY_RE);
    const [shard, file] = key.split('/');
    expect(file.startsWith(shard)).toBe(true);
  });

  it('розширення виводиться з MIME, jpeg → jpg', () => {
    expect(mediaKey('image/jpeg').endsWith('.jpg')).toBe(true);
    expect(mediaKey('image/webp').endsWith('.webp')).toBe(true);
    expect(mediaKey('image/avif').endsWith('.avif')).toBe(true);
    expect(mediaKey('image/gif').endsWith('.gif')).toBe(true);
  });

  it('ключі не повторюються', () => {
    const keys = new Set(Array.from({ length: 500 }, () => mediaKey('image/png')));
    expect(keys.size).toBe(500);
  });

  it('MEDIA_KEY_RE відбиває traversal і чужі розширення', () => {
    expect('../etc/passwd').not.toMatch(MEDIA_KEY_RE);
    expect('ab/../../etc/passwd').not.toMatch(MEDIA_KEY_RE);
    expect('ab/ab000000-0000-4000-8000-000000000000.svg').not.toMatch(MEDIA_KEY_RE);
    expect('ab/ab000000-0000-4000-8000-000000000000.png\n').not.toMatch(MEDIA_KEY_RE);
  });
});
```

- [ ] **Step 2: Написати падаючі тести MIME-сніфера**

`packages/simplycms/src/storage/__tests__/mime.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { sniffImageMime } from '../mime';

const bytes = (...values: number[]) => Uint8Array.from(values);
const ascii = (text: string) => Uint8Array.from(text, (c) => c.charCodeAt(0));
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};

describe('sniffImageMime', () => {
  it('PNG', () => {
    expect(sniffImageMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0))).toBe('image/png');
  });

  it('JPEG', () => {
    expect(sniffImageMime(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0))).toBe('image/jpeg');
  });

  it('GIF87a і GIF89a', () => {
    expect(sniffImageMime(concat(ascii('GIF87a'), bytes(0, 0, 0, 0, 0, 0)))).toBe('image/gif');
    expect(sniffImageMime(concat(ascii('GIF89a'), bytes(0, 0, 0, 0, 0, 0)))).toBe('image/gif');
  });

  it('WebP — RIFF ... WEBP', () => {
    expect(sniffImageMime(concat(ascii('RIFF'), bytes(1, 2, 3, 4), ascii('WEBP'), bytes(0, 0)))).toBe('image/webp');
  });

  it('AVIF — ftyp із брендом avif/avis', () => {
    expect(sniffImageMime(concat(bytes(0, 0, 0, 0x20), ascii('ftyp'), ascii('avif'), bytes(0, 0)))).toBe('image/avif');
    expect(sniffImageMime(concat(bytes(0, 0, 0, 0x20), ascii('ftyp'), ascii('avis'), bytes(0, 0)))).toBe('image/avif');
  });

  // 🔴 Це не «ще один негативний кейс»: SVG — виконуваний формат, і саме він
  // перетворює завантаження картинки на XSS. Рішення Е2-10.
  it('SVG відбивається, і з XML-прологом теж', () => {
    expect(sniffImageMime(ascii('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(sniffImageMime(ascii('<?xml version="1.0"?><svg/>'))).toBeNull();
  });

  it('RIFF без WEBP (наприклад wav) відбивається', () => {
    expect(sniffImageMime(concat(ascii('RIFF'), bytes(1, 2, 3, 4), ascii('WAVE'), bytes(0, 0)))).toBeNull();
  });

  it('порожній і закороткий вхід → null', () => {
    expect(sniffImageMime(new Uint8Array())).toBeNull();
    expect(sniffImageMime(bytes(0x89, 0x50))).toBeNull();
  });
});
```

- [ ] **Step 3: Прогнати обидва — мають впасти**

Run: `pnpm vitest run packages/simplycms/src/storage/__tests__/`
Expected: FAIL — модулів `../keys` і `../mime` немає.

- [ ] **Step 4: Написати `storage/keys.ts`**

```ts
import { randomUUID } from 'node:crypto';

/** MIME, які приймає порт у Е2. SVG відсутній свідомо (рішення Е2-10). */
export type MediaMime =
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'
  | 'image/gif'
  | 'image/avif';

const EXT_BY_MIME: Readonly<Record<MediaMime, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

/**
 * Ключ обʼєкта: `ab/<uuid>.<ext>`, де `ab` — перші два hex-символи того ж
 * uuid.
 *
 * 🔴 Шард не декорація: без нього тека сховища магазину на десятки тисяч
 * файлів стає плоским каталогом, який деградує і в ФС, і в будь-якому `ls`.
 * Два символи дають 256 тек — достатньо для self-host і дешево.
 *
 * 🔴 Ключ ІММУТАБЕЛЬНИЙ: нове зображення завжди новий ключ. Саме на цьому
 * тримається `Cache-Control: immutable` у роздачі (Task 4) — перезапис
 * ключа зробив би кеш брехливим на роки.
 */
export function mediaKey(mime: MediaMime): string {
  const id = randomUUID();
  return `${id.slice(0, 2)}/${id}.${EXT_BY_MIME[mime]}`;
}

/**
 * Форма ключа — саме як РЕГЕКС, а не як `path.normalize`: сюди приходить
 * рядок із URL, і єдиний безпечний спосіб — не «почистити» його, а звірити
 * з шаблоном і відбити все інше. Якорі `^`/`$` тут критичні (без них
 * `\n`-хвіст пройшов би), тому `$` — саме кінець рядка, а не кінець рядка
 * тексту: прапорця `m` у виразі немає.
 */
export const MEDIA_KEY_RE =
  /^[0-9a-f]{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:png|jpg|webp|gif|avif)$/;

/** MIME за ключем — для заголовка роздачі, якщо рядок `media` недоступний. */
export const MIME_BY_EXT: Readonly<Record<string, MediaMime>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
};
```

- [ ] **Step 5: Написати `storage/mime.ts`**

```ts
import type { MediaMime } from './keys';

/**
 * MIME за МАГІЧНИМИ БАЙТАМИ, а не за розширенням і не за `file.type`.
 *
 * 🔴 Обидва альтернативні джерела задає клієнт: розширення — це кінець імені
 * файлу, `file.type` — заголовок, який браузер бере з того ж розширення.
 * Тобто `payload.php.png` із `type: image/png` пройшов би обидві перевірки.
 * Байти підмінити не можна — вони і є вміст.
 */
export function sniffImageMime(bytes: Uint8Array): MediaMime | null {
  if (bytes.length < 12) return null;

  const at = (offset: number, ...expected: number[]): boolean =>
    expected.every((byte, i) => bytes[offset + i] === byte);

  const ascii = (offset: number, text: string): boolean =>
    at(offset, ...Array.from(text, (c) => c.charCodeAt(0)));

  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (ascii(0, 'GIF87a') || ascii(0, 'GIF89a')) return 'image/gif';
  // RIFF-контейнер несе не лише WebP (ще й WAVE, AVI) — бренд на зсуві 8
  // обовʼязковий.
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'image/webp';
  // ISO-BMFF: розмір бокса (4 байти) → 'ftyp' → бренд.
  if (ascii(4, 'ftyp') && (ascii(8, 'avif') || ascii(8, 'avis'))) return 'image/avif';

  return null;
}
```

- [ ] **Step 6: Прогнати — мають пройти**

Run: `pnpm vitest run packages/simplycms/src/storage/__tests__/keys.test.ts packages/simplycms/src/storage/__tests__/mime.test.ts`
Expected: PASS.

- [ ] **Step 7: Написати падаючі тести драйвера**

`packages/simplycms/src/storage/__tests__/local-fs.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MediaKeyCollisionError, MediaKeyError, localFsDriver } from '../local-fs';
import { MEDIA_KEY_RE } from '../keys';

const KEY = 'ab/ab000000-0000-4000-8000-000000000000.png';
const PAYLOAD = Uint8Array.from([1, 2, 3, 4]);

describe('localFsDriver', () => {
  let root: string;
  let driver: ReturnType<typeof localFsDriver>;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'simplycms-media-'));
    driver = localFsDriver(root);
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('put створює шард-теку й кладе байти', async () => {
    await driver.put(KEY, PAYLOAD);
    expect(new Uint8Array(await readFile(join(root, KEY)))).toEqual(PAYLOAD);
  });

  it('put на зайнятий ключ падає MediaKeyCollisionError і НЕ перезаписує', async () => {
    await driver.put(KEY, PAYLOAD);
    await expect(driver.put(KEY, Uint8Array.from([9, 9]))).rejects.toBeInstanceOf(
      MediaKeyCollisionError,
    );
    expect(new Uint8Array(await readFile(join(root, KEY)))).toEqual(PAYLOAD);
  });

  it('put не лишає тимчасових файлів — ні після успіху, ні після колізії', async () => {
    await driver.put(KEY, PAYLOAD);
    await driver.put(KEY, PAYLOAD).catch(() => undefined);
    const shard = await readdir(join(root, 'ab'));
    expect(shard.filter((name) => name.startsWith('.tmp-'))).toEqual([]);
  });

  // 🔴 Не косметика імені: сирота `.tmp-*` після падіння між `link` і
  // `unlink` — названа межа Е2, і єдине, що робить її нешкідливою, — те,
  // що роут роздачі такого імені не приймає.
  it('імʼя тимчасового файлу НЕ матчить MEDIA_KEY_RE', async () => {
    let captured = '';
    const spy = localFsDriver(root);
    // Перехоплюємо імена, що зʼявляються в шард-теці під час запису.
    const watcher = setInterval(async () => {
      const names = await readdir(join(root, 'cd')).catch(() => []);
      const tmp = names.find((n) => !MEDIA_KEY_RE.test(`cd/${n}`));
      if (tmp) captured = tmp;
    }, 1);
    await spy.put('cd/cd000000-0000-4000-8000-000000000000.png', PAYLOAD);
    clearInterval(watcher);
    // Незалежно від того, чи встиг таймер, сама форма імені перевіряється
    // детерміністично: жодне `.tmp-*` не може пройти регекс ключа.
    expect(MEDIA_KEY_RE.test(`cd/.tmp-${'0'.repeat(36)}`)).toBe(false);
    if (captured) expect(MEDIA_KEY_RE.test(`cd/${captured}`)).toBe(false);
  });

  it('delete прибирає обʼєкт', async () => {
    await driver.put(KEY, PAYLOAD);
    await driver.delete(KEY);
    expect(await driver.open(KEY)).toBeNull();
  });

  it('delete відсутнього — УСПІХ (ідемпотентність, рішення Е2-7)', async () => {
    await expect(driver.delete(KEY)).resolves.toBeUndefined();
    await expect(driver.delete(KEY)).resolves.toBeUndefined();
  });

  it('open віддає розмір і стрім із тими самими байтами', async () => {
    await driver.put(KEY, PAYLOAD);
    const object = await driver.open(KEY);
    expect(object?.size).toBe(PAYLOAD.length);
    const chunks: Uint8Array[] = [];
    for await (const chunk of object!.stream() as unknown as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    expect(Buffer.concat(chunks.map((c) => Buffer.from(c)))).toEqual(Buffer.from(PAYLOAD));
  });

  it('open відсутнього → null, а не виняток', async () => {
    expect(await driver.open(KEY)).toBeNull();
  });

  // 🔴 Traversal перевіряється на ДРАЙВЕРІ, а не лише в роуті: другий
  // виклик порту (адмінка) прийде не з URL і роутового гарда не матиме.
  it.each([
    '../escape.png',
    'ab/../../escape.png',
    '/etc/passwd',
    'ab/ab000000-0000-4000-8000-000000000000.png/../../../escape.png',
  ])('ключ поза коренем відбивається: %s', async (bad) => {
    await expect(driver.put(bad, PAYLOAD)).rejects.toBeInstanceOf(MediaKeyError);
    await expect(driver.delete(bad)).rejects.toBeInstanceOf(MediaKeyError);
    await expect(driver.open(bad)).rejects.toBeInstanceOf(MediaKeyError);
  });

  it('файл поза коренем не читається навіть якщо існує', async () => {
    const outside = join(root, '..', `escape-${process.pid}.png`);
    await writeFile(outside, PAYLOAD);
    try {
      await expect(driver.open(`../escape-${process.pid}.png`)).rejects.toBeInstanceOf(
        MediaKeyError,
      );
    } finally {
      await rm(outside, { force: true });
    }
  });
});
```

- [ ] **Step 8: Прогнати — має впасти**

Run: `pnpm vitest run packages/simplycms/src/storage/__tests__/local-fs.test.ts`
Expected: FAIL — модуля `../local-fs` немає.

- [ ] **Step 9: Написати `storage/driver.ts`**

```ts
/** Обʼєкт сховища, готовий до роздачі. */
export interface MediaObject {
  readonly size: number;
  /** Новий стрім на кожен виклик — відповідь можна віддати лише раз. */
  stream(): ReadableStream<Uint8Array>;
}

/**
 * Контракт драйвера сховища — СЕРВЕРНИЙ (рішення Е2-2).
 *
 * 🔴 Три методи й жодного `url`: адресу будує `resolveMediaUrl` (T1) з бази
 * драйвера, бо її мусить знати й клієнт, а драйвер у клієнт не потрапляє.
 *
 * 🔴 Присвоєння ключа тут НЕМАЄ навмисно: ключ генерує викликач
 * (`mediaKey`), бо той самий ключ мусить лягти в рядок `media` в ТІЙ САМІЙ
 * транзакції (Task 3). Драйвер, що вигадував би ключ сам, зробив би запис
 * рядка залежним від успіху запису файлу — тобто вивернув би порядок,
 * заданий інваріантами §4-К4.
 *
 * Драйвер `s3` у К4 реалізує рівно цей інтерфейс; presigned direct-upload
 * приходить туди АДИТИВНИМ `signPut?(key)`, не зміною цих трьох.
 */
export interface MediaStorageDriver {
  /** Записує НОВИЙ обʼєкт. Зайнятий ключ — `MediaKeyCollisionError`. */
  put(key: string, bytes: Uint8Array): Promise<void>;
  /** Видаляє обʼєкт. Відсутній — УСПІХ (ідемпотентність, рішення Е2-7). */
  delete(key: string): Promise<void>;
  /** Обʼєкт для роздачі або `null`, якщо ключа немає. */
  open(key: string): Promise<MediaObject | null>;
}

/** Ключ не відповідає контракту або веде за межі кореня сховища. */
export class MediaKeyError extends Error {
  constructor(readonly key: string) {
    super(`[simplycms/storage] Неприпустимий ключ медіа: ${JSON.stringify(key)}.`);
    this.name = 'MediaKeyError';
  }
}

/** Ключ уже зайнятий. Обʼєкти іммутабельні — перезапис заборонено (Е2-8). */
export class MediaKeyCollisionError extends Error {
  constructor(readonly key: string) {
    super(`[simplycms/storage] Ключ медіа вже зайнятий: ${key}.`);
    this.name = 'MediaKeyCollisionError';
  }
}
```

- [ ] **Step 10: Написати `storage/env.ts`**

```ts
import { resolve } from 'node:path';

/** Корінь сховища за замовчуванням — відносно робочої теки процесу. */
export const DEFAULT_MEDIA_ROOT = '.data/media';

/**
 * Корінь сховища драйвера `local-fs`.
 *
 * 🔴 Читається з `process.env` і ТІЛЬКИ в рантаймі, всередині функції —
 * контракт серверного env (спека CLI v1 §7). Модуль-рівнева константа
 * запеклася б у момент імпорту, і ротація ключа перестала б діяти без
 * перезбірки — рівно те, чого контракт уникає.
 *
 * 🔴 Ключ ОПЦІЙНИЙ (рішення Е2-4): магазин без нього працює, а хмара
 * (змонтований том Dokploy) і будь-який хостинг мають чим вказати шлях.
 */
export function mediaRoot(): string {
  return resolve(process.cwd(), process.env.MEDIA_ROOT ?? DEFAULT_MEDIA_ROOT);
}
```

- [ ] **Step 11: Написати `storage/local-fs.ts`**

```ts
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { link, mkdir, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';

import {
  MediaKeyCollisionError,
  MediaKeyError,
  type MediaObject,
  type MediaStorageDriver,
} from './driver';
import { mediaRoot } from './env';

/** Код помилки Node (`fs` кидає `Error` із полем `code`). */
const codeOf = (error: unknown): string | undefined =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined;

/**
 * Драйвер диска — дефолт self-host (B4).
 *
 * 🔴 Запис: тимчасовий файл → `link()` → прибирання тимчасового. Саме
 * `link`, а не `rename`: `rename` атомарний, але МОВЧКИ перезаписує ціль,
 * а нам потрібні обидві властивості одразу — і атомарна публікація
 * (частково записаний файл не видно роуту роздачі), і виключність
 * (іммутабельний ключ, рішення Е2-8). `link` дає обидві: він падає з
 * `EEXIST`, якщо ціль є, і публікує повністю записаний вміст одним кроком.
 * Тимчасовий файл лежить у ТІЙ САМІЙ шард-теці — `link` не працює через
 * межу файлової системи.
 */
export function localFsDriver(root: string = mediaRoot()): MediaStorageDriver {
  const base = resolve(root);

  const pathFor = (key: string): string => {
    // 🔴 `resolve` спершу, перевірка ПОТІМ: перевіряти сирий рядок марно —
    // `ab/../../x` виглядає невинно, доки його не нормалізувати.
    const target = resolve(base, key);
    if (target !== base && !target.startsWith(base + sep)) throw new MediaKeyError(key);
    if (target === base) throw new MediaKeyError(key);
    return target;
  };

  return {
    async put(key, bytes) {
      const target = pathFor(key);
      const shard = dirname(target);
      await mkdir(shard, { recursive: true });
      // 🔴 Імʼя тимчасового файлу НЕ МАЄ матчити `MEDIA_KEY_RE`: інакше
      // частково записаний файл віддавався б роутом роздачі як валідний
      // обʼєкт. Префікс `.tmp-` виводить його з-під регексу і за розширенням
      // (його немає з дозволених), і за початковою крапкою.
      const tmp = join(shard, `.tmp-${randomUUID()}`);
      await writeFile(tmp, bytes, { flag: 'wx' });
      try {
        await link(tmp, target);
      } catch (error) {
        if (codeOf(error) === 'EEXIST') throw new MediaKeyCollisionError(key);
        throw error;
      } finally {
        // 🔴 Прибирання best-effort: обʼєкт уже опублікований `link`-ом, тож
        // невдалий `unlink` нічого не ламає. Названа межа Е2: падіння процесу
        // МІЖ `link` і `unlink` лишає сироту `.tmp-*` — її змітає sweep К4,
        // а роздача її не віддасть (імʼя поза `MEDIA_KEY_RE`).
        await rm(tmp, { force: true }).catch(() => undefined);
      }
    },

    async delete(key) {
      const target = pathFor(key);
      try {
        await unlink(target);
      } catch (error) {
        // 🔴 ENOENT = успіх: видалення ідемпотентне, інакше повтор після
        // невдалого видалення рядка `media` (рішення Е2-7) падав би вічно.
        if (codeOf(error) !== 'ENOENT') throw error;
      }
    },

    async open(key): Promise<MediaObject | null> {
      const target = pathFor(key);
      let size: number;
      try {
        const info = await stat(target);
        if (!info.isFile()) return null;
        size = info.size;
      } catch (error) {
        if (codeOf(error) === 'ENOENT') return null;
        throw error;
      }
      return {
        size,
        stream: () =>
          Readable.toWeb(createReadStream(target)) as ReadableStream<Uint8Array>,
      };
    },
  };
}

let cached: MediaStorageDriver | null = null;

/**
 * Дефолтний драйвер магазину. Мемоізований — але саме тут, а не в
 * модуль-рівневому `const`: інстанс створюється при ПЕРШОМУ виклику, коли
 * `process.env.MEDIA_ROOT` уже наповнено (`server.mjs` робить це перед
 * динамічним імпортом хендлера).
 */
export function getMediaDriver(): MediaStorageDriver {
  cached ??= localFsDriver();
  return cached;
}

export { MediaKeyCollisionError, MediaKeyError };
```

- [ ] **Step 12: Написати `storage/index.ts`**

```ts
// Порт сховища файлів — server-only піддерево (`contracts/server-only`).
//
// 🔴 Клієнту звідси НЕ ПОТРІБНО нічого: резолв URL живе в
// `simplycms/domain/media` (T1, чистий), а запис і видалення — серверні
// операції за serverFn. Саме тому все піддерево в `SERVER_ONLY`.
export { DEFAULT_MEDIA_ROOT, mediaRoot } from './env';
export { MEDIA_KEY_RE, MIME_BY_EXT, mediaKey, type MediaMime } from './keys';
export { sniffImageMime } from './mime';
export {
  MediaKeyCollisionError,
  MediaKeyError,
  type MediaObject,
  type MediaStorageDriver,
} from './driver';
export { getMediaDriver, localFsDriver } from './local-fs';
```

- [ ] **Step 13: Прогнати тести драйвера**

Run: `pnpm vitest run packages/simplycms/src/storage/__tests__/`
Expected: PASS (усі три файли).

- [ ] **Step 14: Оголосити межу клієнт/сервер**

У `packages/simplycms/src/contracts/server-only.ts` у масив `SERVER_ONLY` додати останнім рядком:

```ts
  // Порт сховища: `node:fs`, корінь із env і драйвер. Клієнт бере лише
  // `domain/media` (чистий резолв URL) — сюди йому не треба нічого.
  'storage',
```

- [ ] **Step 15: Прогнати packaging-suite — гейт сентинелів мусить ЧЕРВОНІТИ**

```bash
pnpm build:packages && pnpm test:packaging
```
Expected: FAIL у `tests/dist-server-boundary.test.ts` — `Object.keys(SENTINELS)` не збігається з `SERVER_ONLY`. **Це гейт у дії.** Зафіксуй текст помилки в звіті задачі — він і є негативний контроль цього кроку.

- [ ] **Step 16: Додати сентинел**

У `tests/dist-server-boundary.test.ts` у мапу `SENTINELS` (≈рядок 170) додати запис для `storage`. Літерал — рядок, який ГАРАНТОВАНО є в джерелі піддерева й не є в клієнтському `dist`; візьми унікальний фрагмент коментаря драйвера:

```ts
  storage: 'Тимчасовий файл лежить у ТІЙ САМІЙ шард-теці',
```

🔴 Перед комітом переконайся, що літерал справді присутній:
```bash
grep -c 'Тимчасовий файл лежить у ТІЙ САМІЙ шард-теці' packages/simplycms/src/storage/local-fs.ts
```
Expected: `1`.

- [ ] **Step 17: Додати тір-зону**

У `eslint.tier-zones.mjs` у масив `TIER_ZONES` — після рядка `['src/admin-server', 2, 'admin-server', ['db', 'auth']],`:

```js
  // Порт сховища (Е2) — T2. Upward-виняток `db` той самий, що в `auth` і
  // `storefront`: рядок `media` пишеться через `withActor`, іншого каналу
  // до Postgres немає. `auth` НЕ у винятку — грант перевіряє викликач
  // (serverFn), а не сам порт.
  ['src/storage', 2, 'storage', ['db']],
```

- [ ] **Step 18: Додати субшлях в exports**

У `packages/simplycms/package.json` — `exports`:

```json
"./storage": "./src/storage/index.ts",
```

`publishConfig.exports`:

```json
"./storage": { "types": "./dist/storage/index.d.ts", "import": "./dist/storage/index.js" },
```

- [ ] **Step 19: Розширити контракт env опційним ключем**

У `.env.example` — новий блок ПІСЛЯ блоку Site і ПЕРЕД блоком PG-харнеса:

```
# -----------------------------------------------------------------------------
# Media storage (optional) — SERVER-ONLY
# -----------------------------------------------------------------------------
# Root directory of the `local-fs` media driver: uploaded images live here and
# are served by the core route `/media/*`. Optional — without it the store uses
# `./.data/media` relative to the server's working directory.
#
# 🔴 Set it in production to a path that survives redeploys (a mounted volume).
# The default lives inside the deploy directory, so a fresh deploy would start
# with an empty store and every uploaded image would 404.
# MEDIA_ROOT=/var/lib/simplycms/media
```

Той самий блок — у `packages/create-simplycms-store/template/env.example`.
🔴 Ці два файли **не** синкуються `template:sync` (їх немає в `SYNCED_FILES`) — правиш обидва руками.

- [ ] **Step 20: Ігнорувати теку сховища в git**

У `.gitignore` (корінь) і в `packages/create-simplycms-store/template/gitignore`:

```
# Локальне сховище медіа (драйвер local-fs, дефолт MEDIA_ROOT)
.data/
```

- [ ] **Step 21: Написати падаючий тест на опційні ключі**

У `tests/env-contract.test.ts` — після константи `SERVER_ONLY` додати:

```ts
/**
 * Опційні ключі: працюють, якщо задані, але магазин без них стартує.
 * 🔴 Присутні в `.env.example` РІВНО коментарем — активний рядок зробив би
 * їх частиною контракту (тест `активні ключі — рівно контракт` червонів би),
 * а відсутність позбавила б магазин єдиної документації про них.
 */
const OPTIONAL = ['BETTER_AUTH_URL', 'MEDIA_ROOT'] as const;
```

і новий блок замість наявного `it('BETTER_AUTH_URL — опційний і задокументований як такий')`:

```ts
  it.each(OPTIONAL)('%s — присутній коментарем і НЕ активним ключем', (key) => {
    const example = readFileSync(resolve(ROOT, '.env.example'), 'utf8');
    expect(example, `${key} не задокументовано`).toMatch(
      new RegExp(`^# ${key}=`, 'm'),
    );
    expect(example).not.toMatch(new RegExp(`^${key}=`, 'm'));
  });

  it('BETTER_AUTH_URL пояснює наслідок жорсткого origin', () => {
    const example = readFileSync(resolve(ROOT, '.env.example'), 'utf8');
    expect(example).toMatch(/INVALID_ORIGIN/);
  });

  it('MEDIA_ROOT пояснює, чому дефолт не годиться для прода', () => {
    const example = readFileSync(resolve(ROOT, '.env.example'), 'utf8');
    expect(example).toMatch(/mounted volume/);
  });

  it('шаблон магазину документує ті самі опційні ключі', () => {
    const template = readFileSync(
      resolve(ROOT, 'packages/create-simplycms-store/template/env.example'),
      'utf8',
    );
    for (const key of OPTIONAL) {
      expect(template, `${key} відсутній у шаблоні`).toMatch(
        new RegExp(`^# ${key}=`, 'm'),
      );
    }
  });
```

- [ ] **Step 22: Прогнати env-контракт**

Run: `pnpm vitest run tests/env-contract.test.ts`
Expected: PASS (усі блоки, включно з наявним «активні ключі — рівно контракт» — `MEDIA_ROOT` закоментований, тож контракт лишається трьома ключами).

- [ ] **Step 23: Негативний контроль контракту (прогнати руками, не комітити)**

Розкоментуй `MEDIA_ROOT=` у `.env.example` (зроби активним) і прожени той самий файл.
Expected: FAIL одразу в ДВОХ тестах — «активні ключі — рівно контракт» (зʼявився четвертий) і «MEDIA_ROOT — присутній коментарем». Поверни коментар.

- [ ] **Step 24: Повний гейт задачі**

```bash
pnpm install --frozen-lockfile
pnpm lint && pnpm build && pnpm typecheck && pnpm test
pnpm build:packages && pnpm typecheck:template && pnpm test:packaging
```
Expected: усе PASS. `test:packaging` тепер зелений — сентинел на місці.

- [ ] **Step 25: Коміт**

```bash
git add packages/simplycms/src/storage packages/simplycms/src/contracts/server-only.ts \
        tests/dist-server-boundary.test.ts tests/env-contract.test.ts \
        eslint.tier-zones.mjs packages/simplycms/package.json \
        .env.example .gitignore \
        packages/create-simplycms-store/template/env.example \
        packages/create-simplycms-store/template/gitignore
git commit -m "feat(k3-e2): порт сховища simplycms/storage — драйвер local-fs, іммутабельні ключі, MIME за байтами"
```

---

## Task 3: `writeMedia`/`eraseMedia` — файл і рядок `media` в одній транзакції

**Files:**
- Create: `packages/simplycms/src/storage/record.ts`
- Create: `packages/simplycms/test-harness/pg/__tests__/media-record.test.ts`
- Modify: `packages/simplycms/src/storage/index.ts` (реекспорт)

**Interfaces:**
- Consumes: з Task 2 — `MediaStorageDriver`, `MediaMime`, `mediaKey`, `getMediaDriver`.
- Produces:
  - `export interface WriteMediaInput { bytes: Uint8Array; mime: MediaMime; entityType: string; entityId: string | null; uploadedBy: string | null }`
  - `export interface MediaRecord { id: string; ref: string; sizeBytes: number; mime: MediaMime }`
  - `export async function writeMedia(db: ActorDb, input: WriteMediaInput, driver?: MediaStorageDriver): Promise<MediaRecord>`
  - `export async function eraseMedia(db: ActorDb, ref: string, driver?: MediaStorageDriver): Promise<boolean>`

- [ ] **Step 1: Написати падаючий харнес-тест**

`packages/simplycms/test-harness/pg/__tests__/media-record.test.ts`:

```ts
// Шапка — той самий патерн, що в admin-order-statuses.test.ts: resolveHarness
// → createTempDatabase → канон → app_runtime у DATABASE_URL; afterAll із
// closeDbPool() ПЕРШИМ.
import { readdirSync } from 'node:fs';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDbPool, withActor } from 'simplycms/db';
import { eraseMedia, localFsDriver, writeMedia } from 'simplycms/storage';
import { resolveHarness } from '../up.mjs';
import {
  applySqlFiles,
  createTempDatabase,
  dropTempDatabase,
  queryRows,
  randomDbName,
  withDbName,
  withUser,
} from '../apply.mjs';

const MIGRATIONS = join(import.meta.dirname, '../../../migrations');
const canonFiles = (): string[] =>
  readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => join(MIGRATIONS, name));

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

describe('writeMedia / eraseMedia проти живої БД (Е2, Task 3)', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_media_record');
  let dbUrl = '';
  let root = '';
  const driver = () => localFsDriver(root);

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(dbUrl, canonFiles());
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
    root = await mkdtemp(join(tmpdir(), 'simplycms-media-rec-'));
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    delete process.env.DATABASE_URL;
    if (root) await rm(root, { recursive: true, force: true });
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  const countMedia = async (): Promise<number> => {
    const [row] = (await queryRows(
      dbUrl,
      'select count(*)::int as n from public.media',
    )) as { n: number }[];
    return row.n;
  };

  it('пише файл і рядок з правильним size_bytes та mime_type', async () => {
    const record = await withActor({ role: 'app_admin' }, (db) =>
      writeMedia(
        db,
        {
          bytes: PNG,
          mime: 'image/png',
          entityType: 'product',
          entityId: null,
          uploadedBy: null,
        },
        driver(),
      ),
    );

    expect(record.ref).toMatch(/^[0-9a-f]{2}\//);
    expect(record.sizeBytes).toBe(PNG.length);

    const rows = await queryRows(
      dbUrl,
      `select storage_key, size_bytes, mime_type, entity_type
         from public.media where id = $1`,
      [record.id],
    );
    expect(rows).toEqual([
      {
        storage_key: record.ref,
        size_bytes: PNG.length,
        mime_type: 'image/png',
        entity_type: 'product',
      },
    ]);
    expect(await driver().open(record.ref)).not.toBeNull();
  });

  // 🔴 Ядро інваріанта §4-К4: облік і файл живуть або разом, або ніяк.
  it('падіння запису файлу відкочує рядок — ні файла, ні обліку', async () => {
    const before = await countMedia();
    const broken = {
      ...driver(),
      put: async () => {
        throw new Error('диск переповнено');
      },
    };

    await expect(
      withActor({ role: 'app_admin' }, (db) =>
        writeMedia(
          db,
          {
            bytes: PNG,
            mime: 'image/png',
            entityType: 'product',
            entityId: null,
            uploadedBy: null,
          },
          broken,
        ),
      ),
    ).rejects.toThrow('диск переповнено');

    expect(await countMedia()).toBe(before);
  });

  it('eraseMedia прибирає СПЕРШУ обʼєкт, ПОТІМ рядок', async () => {
    const order: string[] = [];
    const real = driver();
    const record = await withActor({ role: 'app_admin' }, (db) =>
      writeMedia(
        db,
        { bytes: PNG, mime: 'image/png', entityType: 'banner', entityId: null, uploadedBy: null },
        real,
      ),
    );

    const spy = {
      ...real,
      delete: async (key: string) => {
        order.push('object');
        await real.delete(key);
      },
    };
    const removed = await withActor({ role: 'app_admin' }, async (db) => {
      const result = await eraseMedia(db, record.ref, spy);
      order.push('row');
      return result;
    });

    expect(removed).toBe(true);
    expect(order).toEqual(['object', 'row']);
    expect(await real.open(record.ref)).toBeNull();
  });

  it('eraseMedia неіснуючого референсу — false, без винятку', async () => {
    const removed = await withActor({ role: 'app_admin' }, (db) =>
      eraseMedia(db, `ff/${randomUUID()}.png`, driver()),
    );
    expect(removed).toBe(false);
  });

  it('повтор eraseMedia після видаленого файлу проходить (ідемпотентність)', async () => {
    const real = driver();
    const record = await withActor({ role: 'app_admin' }, (db) =>
      writeMedia(
        db,
        { bytes: PNG, mime: 'image/png', entityType: 'banner', entityId: null, uploadedBy: null },
        real,
      ),
    );
    await real.delete(record.ref); // імітуємо перерваний прохід
    const removed = await withActor({ role: 'app_admin' }, (db) =>
      eraseMedia(db, record.ref, real),
    );
    expect(removed).toBe(true);
  });

  // 🔴 Другий рубіж у дії: навіть якщо TS-код помилиться з роллю, БД не дасть
  // покупцеві видалити рядок обліку — гранта DELETE у `app_user` немає.
  it('app_user НЕ сміє видалити рядок media', async () => {
    const real = driver();
    const record = await withActor({ role: 'app_admin' }, (db) =>
      writeMedia(
        db,
        { bytes: PNG, mime: 'image/png', entityType: 'avatar', entityId: null, uploadedBy: null },
        real,
      ),
    );
    await expect(
      withActor({ role: 'app_user' }, (db) => eraseMedia(db, record.ref, real)),
    ).rejects.toThrow(/permission denied/i);
  });

  it('тимчасові файли після всіх прогонів не лишились', async () => {
    for (const shard of await readdir(root)) {
      const files = await readdir(join(root, shard));
      expect(files.filter((n) => n.startsWith('.tmp-'))).toEqual([]);
    }
  });
});
```

- [ ] **Step 2: Прогнати — має впасти**

Run: `pnpm vitest run --config vitest.schema.config.ts packages/simplycms/test-harness/pg/__tests__/media-record.test.ts`
Expected: FAIL — модуля `simplycms/storage/record` немає.

- [ ] **Step 3: Написати `storage/record.ts`**

```ts
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';
import { media } from 'simplycms/schema';

import type { MediaStorageDriver } from './driver';
import { mediaKey, type MediaMime } from './keys';
import { getMediaDriver } from './local-fs';

export interface WriteMediaInput {
  readonly bytes: Uint8Array;
  readonly mime: MediaMime;
  /** До чого належить файл: `product` / `banner` / `section` / `avatar` / … */
  readonly entityType: string;
  /** `null` — файл ще не привʼязаний до рядка (медіатека; привʼязка — К4). */
  readonly entityId: string | null;
  readonly uploadedBy: string | null;
}

export interface MediaRecord {
  readonly id: string;
  /** Те, що лягає в колонку сутності (рішення Е2-1). */
  readonly ref: string;
  readonly sizeBytes: number;
  readonly mime: MediaMime;
}

/**
 * Записати файл і його метадані ОДНИМ актом.
 *
 * 🔴 Порядок усередині — рядок, ПОТІМ файл, і це не сваволя: `size_bytes`
 * мусить лягти в ТУ САМУ транзакцію, що й запис (§4-К4), а транзакцією тут
 * володіє викликач (`withActor`). Тож якщо запис файлу впаде — виняток
 * підніметься з цієї функції, транзакція відкотиться, і не лишиться ні
 * рядка, ні обліку.
 *
 * 🔴 Чого цей порядок НЕ закриває: успішний `put` і невдалий COMMIT після
 * нього лишають обʼєкт без рядка — орфан. ФС не бере участі в двофазному
 * коміті, тож інакше й бути не може; напрямок обрано безпечний (облік
 * НЕ рахує байти, яких ніхто не адресує), а sweep орфанів — К4.
 *
 * 🔴 `id` передається ЯВНО: `DEFAULT gen_random_uuid()` знято на всіх
 * таблицях Категорії A (К3-Е0), тож вставка без `id` дала б `23502`.
 */
export async function writeMedia(
  db: ActorDb,
  input: WriteMediaInput,
  driver: MediaStorageDriver = getMediaDriver(),
): Promise<MediaRecord> {
  const id = randomUUID();
  const ref = mediaKey(input.mime);
  const sizeBytes = input.bytes.byteLength;

  await db.insert(media).values({
    id,
    entityType: input.entityType,
    entityId: input.entityId,
    storageKey: ref,
    sizeBytes,
    mimeType: input.mime,
    uploadedBy: input.uploadedBy,
  });

  await driver.put(ref, input.bytes);

  return { id, ref, sizeBytes, mime: input.mime };
}

/**
 * Прибрати файл і його рядок. Повертає `false`, якщо рядка не було.
 *
 * 🔴 Порядок — СПЕРШУ обʼєкт, ПОТІМ рядок (рішення Е2-7, воно ж §4-К4
 * спеки). Зворотний порядок при обриві лишив би файл, якого ніхто не
 * обліковує; цей — рядок без файлу, тобто облік ПЕРЕоцінює обсяг.
 * Переоцінка безпечна (тариф не занижений), а повтор проходу її виправляє,
 * бо `driver.delete` на відсутньому обʼєкті — успіх.
 *
 * 🔴 НАЗВАНА МЕЖА порядку, і повтор її НЕ лікує: якщо актор не має гранта
 * `DELETE` на `media` (тобто `app_user`), файл уже прибрано, а `db.delete`
 * падає — і падатиме на кожному повторі, бо права не зʼявляться. Рядок
 * лишається сиротою назавжди, поки не прийде sweep К4. У проді цього шляху
 * немає: адмінка ходить під `app_admin`, а заміна аватара — через
 * `operator` (теж `app_admin`). Тому виклик `eraseMedia` під актором без
 * права видалення — це помилка ВИКЛИКАЧА, і ловить її тест
 * «app_user НЕ сміє видалити рядок media» в харнесі Task 3.
 *
 * 🔴 Зовнішні референси (`https:`/`data:`/`/…`) сюди не доходять: вони не
 * є ключами сховища, рядка `media` не мають, і функція чесно поверне
 * `false`, нічого не видаливши.
 */
export async function eraseMedia(
  db: ActorDb,
  ref: string,
  driver: MediaStorageDriver = getMediaDriver(),
): Promise<boolean> {
  const [row] = await db
    .select({ id: media.id })
    .from(media)
    .where(eq(media.storageKey, ref))
    .limit(1);
  if (!row) return false;

  await driver.delete(ref);
  const deleted = await db
    .delete(media)
    .where(and(eq(media.id, row.id), eq(media.storageKey, ref)))
    .returning({ id: media.id });

  return deleted.length > 0;
}
```

- [ ] **Step 4: Реекспортувати з барелю й додати субшлях**

У `packages/simplycms/src/storage/index.ts` додати:

```ts
export {
  eraseMedia,
  writeMedia,
  type MediaRecord,
  type WriteMediaInput,
} from './record';
```

🔴 Окремого субшляху `./storage/record` **не заводимо**: усе піддерево server-only й імпортується через один барель `simplycms/storage`. Нова публічна поверхня має ціну (бієкція `exports` ↔ `dist` під гейтом треку T), а виграшу тут нема — модуль ніхто не імпортує вибірково.

- [ ] **Step 5: Прогнати харнес-тест**

Run: `pnpm vitest run --config vitest.schema.config.ts packages/simplycms/test-harness/pg/__tests__/media-record.test.ts`
Expected: PASS (7 тестів).

- [ ] **Step 6: Перевірити, що гейт `explicit-ids` бачить нову вставку**

Run: `pnpm vitest run --config vitest.schema.config.ts packages/simplycms/test-harness/pg/__tests__/explicit-ids.test.ts`
Expected: PASS — вставка в `writeMedia` передає `id` явно.

- [ ] **Step 7: Негативний контроль контракту id (прогнати руками, не комітити)**

Прибери `id,` з обʼєкта `.values({...})` у `writeMedia` і прожени `explicit-ids`.
Expected: FAIL із назвою `record.ts`. Поверни рядок.

- [ ] **Step 8: Гейт задачі**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm test:schema
```
Expected: PASS.

- [ ] **Step 9: Коміт**

```bash
git add packages/simplycms/src/storage packages/simplycms/package.json \
        packages/simplycms/test-harness/pg/__tests__/media-record.test.ts
git commit -m "feat(k3-e2): writeMedia/eraseMedia — файл і рядок media в одній транзакції актора"
```

---

## Task 4: Роздача `/media/$` — роут ядра

**Files:**
- Create: `packages/simplycms/src/storage/serve.ts`
- Create: `packages/simplycms/src/storage/__tests__/serve.test.ts`
- Create: `packages/simplycms/routes/storefront/media/$.tsx`
- Modify: `packages/simplycms/src/storage/index.ts` (реекспорт `serveMedia`)

**Interfaces:**
- Consumes: з Task 2 — `MediaStorageDriver`, `MEDIA_KEY_RE`, `MIME_BY_EXT`, `getMediaDriver`.
- Produces: `export async function serveMedia(ctx: { request: Request }, driver?: MediaStorageDriver): Promise<Response>`

- [ ] **Step 1: Написати падаючі тести роздачі**

`packages/simplycms/src/storage/__tests__/serve.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { localFsDriver } from '../local-fs';
import { serveMedia } from '../serve';

const KEY = 'ab/ab000000-0000-4000-8000-000000000000.png';
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7, 7, 7, 7]);

describe('serveMedia', () => {
  let root: string;
  let driver: ReturnType<typeof localFsDriver>;
  const get = (path: string) =>
    serveMedia({ request: new Request(`http://localhost${path}`) }, driver);

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'simplycms-serve-'));
    driver = localFsDriver(root);
    await driver.put(KEY, PNG);
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('віддає байти з правильним Content-Type', async () => {
    const response = await get(`/media/${KEY}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('content-length')).toBe(String(PNG.length));
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG);
  });

  // 🔴 Без nosniff браузер сам вирішує, чим є вміст, — і виконує те, що
  // «схоже на HTML». Це другий рубіж після заборони SVG на upload.
  it('ставить nosniff та іммутабельний кеш', async () => {
    const response = await get(`/media/${KEY}`);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=31536000, immutable',
    );
    expect(response.headers.get('etag')).toBe(`"${KEY}"`);
  });

  it('404 на відсутній ключ правильної форми', async () => {
    const response = await get('/media/cd/cd000000-0000-4000-8000-000000000000.png');
    expect(response.status).toBe(404);
  });

  it.each([
    '/media/../../etc/passwd',
    '/media/ab/../../../etc/passwd',
    '/media/ab/ab000000-0000-4000-8000-000000000000.svg',
    '/media/',
    '/media/ab',
  ])('404 на неприпустимий ключ: %s', async (path) => {
    const response = await get(path);
    expect(response.status).toBe(404);
  });

  // 🔴 Кодований traversal — окремий кейс: `%2e%2e` доходить до хендлера
  // вже розкодованим, тож перевірка мусить стояти ПІСЛЯ декодування.
  it('404 на traversal у процентному кодуванні', async () => {
    const response = await get('/media/%2e%2e%2f%2e%2e%2fetc%2fpasswd');
    expect(response.status).toBe(404);
  });

  it('тіло 404 не називає ні шляху, ні кореня сховища', async () => {
    const response = await get('/media/../../etc/passwd');
    const body = await response.text();
    expect(body).not.toContain(root);
    expect(body).not.toContain('etc/passwd');
  });
});
```

- [ ] **Step 2: Прогнати — має впасти**

Run: `pnpm vitest run packages/simplycms/src/storage/__tests__/serve.test.ts`
Expected: FAIL — модуля `../serve` немає.

- [ ] **Step 3: Написати `storage/serve.ts`**

```ts
import type { MediaStorageDriver } from './driver';
import { MEDIA_KEY_RE, MIME_BY_EXT } from './keys';
import { getMediaDriver } from './local-fs';

/** Префікс роздачі — дзеркало `MEDIA_URL_BASE` з `simplycms/domain/media`. */
const PREFIX = '/media/';

/** Одна відповідь «немає» на всі відмови (див. докблок нижче). */
const notFound = (): Response =>
  new Response('Not found', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });

/**
 * GET `/media/<key>` — роздача обʼєктів драйвера сховища.
 *
 * 🔴 Ключ береться з URL і звіряється з `MEDIA_KEY_RE` ДО будь-якого
 * дотику до ФС. Це саме allowlist, а не «санітизація»: спроба почистити
 * рядок від `..` програє кодуванням і нормалізації, а звірка з формою —
 * ні. Другий рубіж — перевірка кореня всередині драйвера (Task 2).
 *
 * 🔴 Усі відмови віддають ОДНАКОВИЙ 404 без деталей: різні коди чи тексти
 * для «форма невірна» / «файла немає» / «шлях за межами» перетворили б
 * роут на оракул структури сховища. Логів тут теж немає — ендпоінт
 * публічний і неавтентифікований, тож будь-хто наповнив би лог із URL.
 *
 * 🔴 `Content-Type` — з РОЗШИРЕННЯ КЛЮЧА, а не з запиту: ключ згенерував
 * сервер із просніфаного MIME (Task 2), тобто це і є перевірене значення.
 * Читати рядок `media` тут було б зайвим походом у БД на кожну картинку.
 *
 * 🔴 `immutable`-кеш законний лише тому, що ключі іммутабельні (Е2-8):
 * новий файл — новий ключ, тож «протухлої» відповіді не існує. Після
 * видалення обʼєкта браузер і CDN можуть ще тримати копію — це прийнятно,
 * бо референс на неї вже зник із рядка сутності.
 */
export async function serveMedia(
  ctx: { request: Request },
  driver: MediaStorageDriver = getMediaDriver(),
): Promise<Response> {
  const { pathname } = new URL(ctx.request.url);
  if (!pathname.startsWith(PREFIX)) return notFound();

  let key: string;
  try {
    key = decodeURIComponent(pathname.slice(PREFIX.length));
  } catch {
    // Биті escape-послідовності — теж «немає».
    return notFound();
  }
  if (!MEDIA_KEY_RE.test(key)) return notFound();

  const ext = key.slice(key.lastIndexOf('.') + 1);
  const contentType = MIME_BY_EXT[ext];
  if (!contentType) return notFound();

  let object;
  try {
    object = await driver.open(key);
  } catch {
    return notFound();
  }
  if (!object) return notFound();

  return new Response(object.stream(), {
    status: 200,
    headers: {
      'content-type': contentType,
      'content-length': String(object.size),
      'cache-control': 'public, max-age=31536000, immutable',
      etag: `"${key}"`,
      'x-content-type-options': 'nosniff',
    },
  });
}
```

- [ ] **Step 4: Прогнати — мають пройти**

Run: `pnpm vitest run packages/simplycms/src/storage/__tests__/serve.test.ts`
Expected: PASS (усі кейси, включно з кодованим traversal).

- [ ] **Step 5: Реекспортувати з барелю**

У `packages/simplycms/src/storage/index.ts`:

```ts
export { serveMedia } from './serve';
```

- [ ] **Step 6: Створити роут**

`packages/simplycms/routes/storefront/media/$.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { serveMedia } from 'simplycms/storage';

/**
 * GET `/media/*` — роздача файлів драйвера сховища (рішення Е2-3).
 *
 * 🔴 Роут Start, а не другий `sirv`-маунт у `server.mjs`: `sirv` не діє в
 * dev (там сервером керує Vite), тож маунт створив би два різні шляхи —
 * і поламані картинки в dev при зелених прод-тестах. Один роут працює
 * однаково в dev, prod, пілоті й `live:smoke`.
 *
 * 🔴 Файл лишає ЄДИНИЙ export — `Route`. Named export звідси пережив би
 * стрипінг властивості `server` і затягнув `node:fs` і корінь сховища в
 * клієнтський бандл; логіка тому живе в `simplycms/storage/serve`.
 * Ловить це Gate C пілота.
 *
 * 🔴 Splat (`$`), а не `$key`: ключ містить `/` (шард), і сегментний
 * параметр обрізав би його по першому слешу.
 */
export const Route = createFileRoute('/media/$')({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => serveMedia({ request }),
    },
  },
});
```

- [ ] **Step 7: Перевірити, що роут змонтувався**

```bash
pnpm build
grep -n "'/media/\$'" src/routeTree.gen.ts
```
Expected: рядок знайдено — `routes.ts` монтує теку `packages/simplycms/routes/storefront` цілком, тож host правити не треба.

- [ ] **Step 8: Живий смок роздачі (руками)**

```bash
mkdir -p .data/media/ab
printf '\x89PNG\r\n\x1a\n\x01\x02\x03\x04' > .data/media/ab/ab000000-0000-4000-8000-000000000000.png
pnpm start &   # потрібні DATABASE_URL і BETTER_AUTH_SECRET у .env.local
curl -sI http://localhost:3000/media/ab/ab000000-0000-4000-8000-000000000000.png
curl -sI http://localhost:3000/media/../../etc/passwd
```
Expected: перший — `200` з `content-type: image/png`, `cache-control: public, max-age=31536000, immutable`, `x-content-type-options: nosniff`; другий — `404`. Прибрати `.data/` після перевірки.

- [ ] **Step 9: Гейт задачі + Gate C**

```bash
pnpm lint && pnpm build && pnpm typecheck && pnpm test
pnpm build:packages && pnpm test:packaging && pnpm pilot:pack
```
Expected: PASS. 🔴 `pilot:pack` тут обовʼязковий — Gate C і Gate IP єдині доводять, що новий роут не витягнув `node:fs` і драйвер у клієнтський бандл СКРЕТЧ-магазину (у монорепо-збірці цього не видно).

- [ ] **Step 10: Коміт**

```bash
git add packages/simplycms/src/storage packages/simplycms/routes/storefront/media
git commit -m "feat(k3-e2): роут /media/\$ — роздача обʼєктів сховища з nosniff та іммутабельним кешем"
```

---

## Task 5: Аватар наскрізь — перший живий споживач порту

**Files:**
- Create: `packages/simplycms/src/core/lib/profile-avatar.ts`
- Create: `packages/simplycms/src/profile-ui/__tests__/avatar-upload.test.tsx`
- Delete: `packages/simplycms/src/profile-ui/__tests__/avatar-upload-disabled.test.tsx`
- Modify: `packages/simplycms/src/profile-ui/AvatarUpload.tsx`
- Modify: `packages/simplycms/src/storefront-routes/pages/ProfileSettings.tsx:225-228`
- Modify: `packages/simplycms/src/storefront/loaders/profile.ts:55`
- Modify: `packages/simplycms/src/i18n/catalogs/uk/profile.ts`, `packages/simplycms/src/i18n/catalogs/en/profile.ts`

**Interfaces:**
- Consumes: Task 1 (`resolveMediaUrl`), Task 3 (`writeMedia`/`eraseMedia`), Task 4 (роздача).
- Produces:
  - `export const uploadMyAvatar: ServerFn` — приймає `FormData` з полем `file`, повертає `{ url: string }`
  - `export const removeMyAvatar: ServerFn` — повертає `void`
  - `AvatarUpload` props: `{ currentAvatarUrl, firstName?, lastName?, email?, onUpdate }` (проп `userId` прибрано)

- [ ] **Step 1: Додати ключі i18n (uk)**

У `packages/simplycms/src/i18n/catalogs/uk/profile.ts` ЗАМІНИТИ `'profile.avatar.unavailable'` на:

```ts
  'profile.avatar.upload': 'Завантажити фото',
  'profile.avatar.remove': 'Видалити фото',
  'profile.avatar.uploading': 'Завантаження…',
  'profile.avatar.badFormat': 'Непідтримуваний формат',
  'profile.avatar.allowedFormats': 'PNG, JPEG, WebP, GIF або AVIF',
  'profile.avatar.tooLarge': 'Файл завеликий',
  'profile.avatar.maxSize': 'Максимальний розмір: 5 МБ',
  'profile.avatar.failed': 'Не вдалося зберегти фото',
```

- [ ] **Step 2: Дзеркалити ключі в `en`**

У `packages/simplycms/src/i18n/catalogs/en/profile.ts` — ті самі вісім ключів, прибравши `'profile.avatar.unavailable'`:

```ts
  'profile.avatar.upload': 'Upload photo',
  'profile.avatar.remove': 'Remove photo',
  'profile.avatar.uploading': 'Uploading…',
  'profile.avatar.badFormat': 'Unsupported format',
  'profile.avatar.allowedFormats': 'PNG, JPEG, WebP, GIF or AVIF',
  'profile.avatar.tooLarge': 'File too large',
  'profile.avatar.maxSize': 'Maximum size: 5 MB',
  'profile.avatar.failed': 'Could not save the photo',
```

- [ ] **Step 3: Прогнати i18n-гейти — мають бути зелені**

Run: `pnpm vitest run tests/i18n-catalog-parity.test.ts packages/simplycms/src/i18n/__tests__/catalog-integrity.test.ts`
Expected: PASS. Червоне тут = ключ додано лише в один каталог.

- [ ] **Step 4: Написати serverFn кабінету**

`packages/simplycms/src/core/lib/profile-avatar.ts`:

```ts
import { createServerFn } from '@tanstack/react-start';
import { eq } from 'drizzle-orm';
import { MEDIA_URL_BASE, resolveMediaUrl } from 'simplycms/domain/media';
import { profiles } from 'simplycms/schema';
import { withSessionDb } from 'simplycms/storefront/loaders';
import { eraseMedia, sniffImageMime, writeMedia } from 'simplycms/storage';

/** Стеля розміру аватара. Start буферизує тіло цілком — межу тримаємо тут. */
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/** Машинні коди відмов: клієнт мапить їх у свої рядки каталогу. */
const BAD_FORMAT = 'avatar/bad-format';
const TOO_LARGE = 'avatar/too-large';

/**
 * Завантажити аватар власника сесії.
 *
 * 🔴 `userId` у вході НЕМАЄ — він завжди з cookie Better Auth
 * (`withSessionDb`). Прийнятий від клієнта id дав би змогу переписати чужий
 * профіль, і RLS не врятувала б: вона звіряє рядки саме з тим актором, якого
 * їй назвали.
 *
 * 🔴 Три дії — вставка рядка `media`, запис файлу і оновлення `profiles` —
 * лежать в ОДНІЙ транзакції актора. Прибирання СТАРОГО аватара — теж у ній,
 * але через `operator`: `app_user` не має `DELETE` на `media` (гранти
 * `0002_grants.sql:120`), і це навмисно — саме відсутність права тримає
 * інваріант незмінності власності.
 *
 * 🔴 Валідатор не Zod, а функція: `inputValidator` зі схемою Zod не приймає
 * `FormData` (Start типізує цю гілку окремо), тож форма перевіряється тут,
 * а вміст — магічними байтами нижче.
 */
export const uploadMyAvatar = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown): FormData => {
    if (!(data instanceof FormData)) {
      throw new Error('[simplycms] uploadMyAvatar expects FormData.');
    }
    return data;
  })
  .handler(async ({ data }): Promise<{ url: string }> => {
    const file = data.get('file');
    if (!(file instanceof File)) throw new Error(BAD_FORMAT);
    if (file.size > MAX_AVATAR_BYTES) throw new Error(TOO_LARGE);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = sniffImageMime(bytes);
    // 🔴 Саме просніфаний MIME, а не `file.type`: останній браузер бере з
    // розширення, тобто його задає той самий, хто вантажить файл.
    if (!mime) throw new Error(BAD_FORMAT);

    return withSessionDb(async (db, userId, operator) => {
      const [current] = await db
        .select({ avatarUrl: profiles.avatarUrl })
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1);

      const record = await writeMedia(db, {
        bytes,
        mime,
        entityType: 'avatar',
        entityId: userId,
        uploadedBy: userId,
      });

      await db
        .update(profiles)
        .set({ avatarUrl: record.ref })
        .where(eq(profiles.userId, userId));

      // Старий обʼєкт прибираємо ПІСЛЯ того, як новий референс уже в рядку:
      // обрив тут лишає осиротілий файл (К4 його змете), а зворотний порядок
      // лишив би профіль із посиланням у нікуди.
      const previous = current?.avatarUrl;
      if (previous) await operator((tx) => eraseMedia(tx, previous));

      return { url: resolveMediaUrl(record.ref, MEDIA_URL_BASE)! };
    });
  });

/** Прибрати аватар власника сесії. Ідемпотентна: без аватара — no-op. */
export const removeMyAvatar = createServerFn({ method: 'POST' }).handler(
  async (): Promise<void> => {
    await withSessionDb(async (db, userId, operator) => {
      const [current] = await db
        .select({ avatarUrl: profiles.avatarUrl })
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1);
      if (!current?.avatarUrl) return;

      await db
        .update(profiles)
        .set({ avatarUrl: null })
        .where(eq(profiles.userId, userId));
      await operator((tx) => eraseMedia(tx, current.avatarUrl!));
    });
  },
);

export { BAD_FORMAT, TOO_LARGE };
```

🔴 Підпис `operator` звірено з `storefront/loaders/escalation.ts:22-24` — це `<T>(fn: (db: ActorDb) => Promise<T>) => Promise<T>`, тобто виклики вище коректні як є. 🔴 Не захоплюй `operator` за межі колбека `withSessionDb`: після завершення транзакції він гучно кидає (`escalation.ts:47-52`).

- [ ] **Step 5: Написати падаючі тести компонента**

`packages/simplycms/src/profile-ui/__tests__/avatar-upload.test.tsx`:

🔴 **Три обмеження тестового стенда, виміряні, а не припущені** (див. знятий
`avatar-upload-disabled.test.tsx`): (1) `environment` у `vitest.config.ts` —
`node`, тож потрібна директива `@vitest-environment jsdom` першим рядком;
(2) `setupFiles` у конфізі НЕМАЄ, тож матчери `@testing-library/jest-dom`
(`toBeDisabled`, `toBeInTheDocument`, `toHaveTextContent`) **не зареєстровані**
— асерти лише звичайні; (3) `@testing-library/user-event` у дереві відсутній —
події шлемо `fireEvent`.

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from 'simplycms/i18n';

const uploadMyAvatar = vi.fn();
const removeMyAvatar = vi.fn();
vi.mock('simplycms/core/lib/profile-avatar', () => ({
  uploadMyAvatar: (...args: unknown[]) => uploadMyAvatar(...args),
  removeMyAvatar: (...args: unknown[]) => removeMyAvatar(...args),
}));

import { AvatarUpload } from '../AvatarUpload';

const png = () =>
  new File([Uint8Array.from([0x89, 0x50, 0x4e, 0x47])], 'a.png', {
    type: 'image/png',
  });

const mount = (props: Partial<Parameters<typeof AvatarUpload>[0]> = {}) =>
  render(
    <I18nProvider locale="uk">
      <AvatarUpload currentAvatarUrl={null} onUpdate={vi.fn()} {...props} />
    </I18nProvider>,
  );

const input = () => screen.getByTestId('avatar-file-input') as HTMLInputElement;

beforeEach(() => {
  uploadMyAvatar.mockReset();
  removeMyAvatar.mockReset();
});

describe('AvatarUpload', () => {
  // 🔴 Центральний асерт етапу: до Е2 компонент чесно відмовляв, і саме цей
  // прапорець був доказом відмови. Тепер він доказ протилежного.
  it('інпут БІЛЬШЕ НЕ disabled — порт сховища живий', () => {
    mount();
    expect(input().disabled).toBe(false);
  });

  it('вибір файлу кличе serverFn із FormData і віддає новий URL нагору', async () => {
    uploadMyAvatar.mockResolvedValue({ url: '/media/ab/x.png' });
    const onUpdate = vi.fn();
    mount({ onUpdate });

    fireEvent.change(input(), { target: { files: [png()] } });

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith('/media/ab/x.png'));
    expect(uploadMyAvatar).toHaveBeenCalledTimes(1);
    const [[arg]] = uploadMyAvatar.mock.calls as [[{ data: FormData }]];
    expect(arg.data).toBeInstanceOf(FormData);
    expect(arg.data.get('file')).toBeInstanceOf(File);
  });

  it('відмова сервера показує причину й НЕ чіпає поточний аватар', async () => {
    uploadMyAvatar.mockRejectedValue(new Error('avatar/bad-format'));
    const onUpdate = vi.fn();
    mount({ currentAvatarUrl: '/media/ab/old.png', onUpdate });

    fireEvent.change(input(), { target: { files: [png()] } });

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'Непідтримуваний формат',
      ),
    );
    expect(onUpdate).not.toHaveBeenCalled();
    expect(
      (screen.getByRole('img') as HTMLImageElement).getAttribute('src'),
    ).toBe('/media/ab/old.png');
  });

  it('невідома помилка дає загальне повідомлення, а не текст винятку', async () => {
    uploadMyAvatar.mockRejectedValue(new Error('ECONNRESET'));
    mount();
    fireEvent.change(input(), { target: { files: [png()] } });
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'Не вдалося зберегти фото',
      ),
    );
  });

  it('кнопка видалення є лише за наявного аватара і кличе removeMyAvatar', async () => {
    mount();
    expect(screen.queryByRole('button', { name: 'Видалити фото' })).toBeNull();

    removeMyAvatar.mockResolvedValue(undefined);
    const onUpdate = vi.fn();
    mount({ currentAvatarUrl: '/media/ab/x.png', onUpdate });
    fireEvent.click(screen.getByRole('button', { name: 'Видалити фото' }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(null));
  });

  it('без аватара показує ініціали', () => {
    mount({ firstName: 'Іван', lastName: 'Петренко' });
    expect(screen.getByText('ІП')).toBeTruthy();
  });

  it('файл понад стелю не доходить до сервера', async () => {
    mount();
    const big = new File([new Uint8Array(6 * 1024 * 1024)], 'big.png', {
      type: 'image/png',
    });
    fireEvent.change(input(), { target: { files: [big] } });
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('завеликий'),
    );
    expect(uploadMyAvatar).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Прогнати — має впасти**

Run: `pnpm vitest run packages/simplycms/src/profile-ui/__tests__/avatar-upload.test.tsx`
Expected: FAIL — компонент іще відмовляє, інпут `disabled`.

- [ ] **Step 7: Оживити `AvatarUpload`**

Замінити `packages/simplycms/src/profile-ui/AvatarUpload.tsx` цілком:

```tsx
import { useRef, useState } from 'react';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import {
  removeMyAvatar,
  uploadMyAvatar,
} from 'simplycms/core/lib/profile-avatar';

interface AvatarUploadProps {
  currentAvatarUrl: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  /** Новий URL або `null` після видалення. */
  onUpdate: (url: string | null) => void;
}

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/**
 * Аватар покупця — ПЕРШИЙ живий споживач порту сховища (рішення Е2-6).
 *
 * 🔴 До Е2 компонент чесно відмовляв: порту не було, а тихий «успіх» на
 * місці зламаного завантаження гірший за гучну відмову. Тепер відмова
 * знята, бо контур справді працює: браузер → serverFn → файл на диску →
 * `/media/<key>` → `<img>`.
 *
 * 🔴 Файл їде `FormData`-ою, а не base64-рядком: Start підтримує FormData
 * у serverFn нативно, а base64 роздув би тіло на третину й утримував би
 * цілий файл у памʼяті двічі.
 */
export function AvatarUpload({
  currentAvatarUrl,
  firstName,
  lastName,
  email,
  onUpdate,
}: AvatarUploadProps) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initials =
    ((firstName?.[0] ?? '') + (lastName?.[0] ?? '')).toUpperCase() ||
    email?.[0]?.toUpperCase() ||
    '?';

  // Машинні коди сервера → рядки каталогу. Розкладка тут, а не на сервері:
  // серверний хендлер живе поза React і транслятора не має.
  const messageFor = (cause: unknown): string => {
    const code = cause instanceof Error ? cause.message : '';
    if (code === 'avatar/bad-format') return t('profile.avatar.badFormat');
    if (code === 'avatar/too-large') return t('profile.avatar.tooLarge');
    return t('profile.avatar.failed');
  };

  const handleSelect = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    // Локальна перевірка розміру — щоб не вантажити 50 МБ і не чекати
    // відмови сервера; сервер перевіряє те саме й лишається джерелом правди.
    if (file.size > MAX_AVATAR_BYTES) {
      setError(t('profile.avatar.tooLarge'));
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.set('file', file);
      const { url } = await uploadMyAvatar({ data: body });
      onUpdate(url);
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    setError(null);
    setBusy(true);
    try {
      await removeMyAvatar();
      onUpdate(null);
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="h-24 w-24 rounded-full overflow-hidden bg-muted flex items-center justify-center text-2xl font-medium">
          {currentAvatarUrl ? (
            <img
              src={currentAvatarUrl}
              alt={t('profile.settings.avatar')}
              width={96}
              height={96}
              className="rounded-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            initials
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label className="sr-only" htmlFor="avatar-file-input">
            {t('profile.settings.avatar')}
          </label>
          <input
            id="avatar-file-input"
            ref={inputRef}
            type="file"
            data-testid="avatar-file-input"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            disabled={busy}
            className="hidden"
            onChange={(e) => void handleSelect(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? t('profile.avatar.uploading') : t('profile.avatar.upload')}
          </Button>
          {currentAvatarUrl && (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => void handleRemove()}
            >
              {t('profile.avatar.remove')}
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            {t('profile.avatar.allowedFormats')} · {t('profile.avatar.maxSize')}
          </p>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Прибрати застарілий тест і оновити сторінку**

```bash
git rm packages/simplycms/src/profile-ui/__tests__/avatar-upload-disabled.test.tsx
```

У `packages/simplycms/src/storefront-routes/pages/ProfileSettings.tsx` (≈рядок 225) замінити виклик:

```tsx
          <AvatarUpload
            currentAvatarUrl={avatarUrl}
            firstName={profileData?.first_name}
            lastName={profileData?.last_name}
            email={user?.email}
            onUpdate={setAvatarUrl}
          />
```

(проп `userId` зникає — сервер бере його з сесії).

🔴 `<CardTitle>{t('profile.settings.avatar')}</CardTitle>` у `<CardHeader>` (рядки 220-222) **ЛИШИТИ**. Це заголовок картки, а не другий `<label>`: він структурує секцію, а підпис інпута дає `<label className="sr-only" htmlFor="avatar-file-input">` усередині компонента. Дублювання `label` не виникає, і `jsx-a11y/label-has-associated-control` задоволене (перевірено в коді 2026-09-13).

- [ ] **Step 9: Резолвити аватар при читанні профілю**

У `packages/simplycms/src/storefront/loaders/profile.ts` — імпорт і рядок 55:

```ts
import { resolveMediaUrl } from 'simplycms/domain/media';
// …
    avatar_url: resolveMediaUrl(row.avatar_url),
```

- [ ] **Step 10: Прогнати тести компонента**

Run: `pnpm vitest run packages/simplycms/src/profile-ui/__tests__/avatar-upload.test.tsx`
Expected: PASS (5 тестів).

- [ ] **Step 11: Живий прогін — ГОЛОВНИЙ доказ етапу**

🔴 **Форма прогону.** Вісім пунктів нижче можна пройти або руками в браузері,
або одноразовим Playwright-скриптом у scratchpad-теці (НЕ комітити — канонічним
закомміченим доказом лишається `live:smoke` Task 9). Скрипт кращий: він
відтворюваний і не покладається на памʼять того, хто клікав. Якщо скрипт не
злітає — фіксуй це боргом у звіті задачі й проходь руками; мовчазний пропуск
пункта — ні. Chromium ставиться on-demand: `pnpm exec playwright install chromium`.

```bash
PG_HARNESS_URL=postgresql://<user>@127.0.0.1:5432/postgres pnpm db:demo
# заповнити .env.local виданим DATABASE_URL + BETTER_AUTH_SECRET + VITE_SITE_URL
pnpm build && pnpm start
```

У браузері: зареєструватись → `/profile/settings` → завантажити PNG.
Expected, і кожен пункт перевірити:
1. Аватар зʼявився на сторінці без перезавантаження.
2. `ls -R .data/media` показує файл під шардом.
3. `psql -c "select storage_key, size_bytes, mime_type, entity_type from media"` — рядок із розміром, рівним розміру файлу на диску.
4. `curl -sI http://localhost:3000/media/<storage_key>` → `200`, `image/png`, `nosniff`.
5. Перезавантажити сторінку — аватар лишився (тобто `loadProfile` резолвить референс).
6. Натиснути «Видалити фото» → `<img>` замінився ініціалами, файл із `.data/media` зник, рядка в `media` немає.
7. Завантажити SVG → видима відмова «Непідтримуваний формат», файл не створено, рядка немає.
8. Завантажити файл > 5 МБ → відмова «Файл завеликий».

Зафіксувати результат кожного пункту в звіті задачі. 🔴 Прибрати `.data/` після прогону і перевірити `git status --porcelain` — має бути порожньо.

- [ ] **Step 12: Гейт задачі**

```bash
pnpm lint && pnpm build && pnpm typecheck && pnpm test
```
Expected: PASS. 🔴 Окремо звір, що `pnpm lint` не дав нових error від i18n-зони (`profile-ui` у ній) — жодного кириличного літерала в компоненті немає.

- [ ] **Step 13: Коміт**

```bash
git add packages/simplycms/src/core/lib/profile-avatar.ts \
        packages/simplycms/src/profile-ui \
        packages/simplycms/src/storefront-routes/pages/ProfileSettings.tsx \
        packages/simplycms/src/storefront/loaders/profile.ts \
        packages/simplycms/src/i18n/catalogs
git commit -m "feat(k3-e2): аватар покупця живий — перший наскрізний споживач порту сховища"
```

---

## Task 6: Резолв решти медіа-колонок вітрини

**Files:**
- Modify: `packages/simplycms/src/storefront/loaders/entities/product.ts:57-60`
- Modify: `packages/simplycms/src/storefront/loaders/entities/banner.ts:45-53`
- Modify: `packages/simplycms/src/storefront/loaders/entities/section.ts`
- Modify: `packages/simplycms/src/storefront/loaders/entities/property.ts`
- Modify: `packages/simplycms/src/storefront/loaders/sections.ts:19,31`
- Modify: `packages/simplycms/src/storefront/loaders/properties.ts:72`
- Modify: `packages/simplycms/src/storefront/loaders/property-option.ts:42`
- Modify: `packages/simplycms/src/storefront/loaders/reviews.ts:59`
- Create: `packages/simplycms/src/storefront/loaders/__tests__/media-resolve.test.ts`

**Interfaces:**
- Consumes: Task 1 — `resolveMediaUrl`, `resolveMediaUrls`, `MEDIA_COLUMNS`.
- Produces: `export function toSectionRow(row: SectionRow): SectionRow`, `export function toOptionRow(row: OptionRow): OptionRow`.

**Чому ця задача існує зараз, а не в Е3.** Демо-магазин сьогодні тримає в `images` порожні масиви, а в банерах — `data:`-URI, тож жоден референс іще не дійшов до вітрини. Саме тому зміна ЗАРАЗ безкоштовна і провірна: `resolveMediaUrl` за побудовою лишає `data:`/`http(s):`/`/…` незмінними. Якщо відкласти її до Е3, перша ж жива сторінка каталогу віддасть покупцеві голий storage key у `src` — і виявиться це на живому магазині, а не на гейті.

- [ ] **Step 1: Написати падаючий тест резолву на рівні лоадерів**

`packages/simplycms/src/storefront/loaders/__tests__/media-resolve.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { toImageList } from '../entities/product';
import { toBanner } from '../entities/banner';
import { toSectionRow } from '../entities/section';
import { toOptionRow } from '../entities/property';

const KEY = 'ab/ab000000-0000-4000-8000-000000000000.png';
const DATA = 'data:image/svg+xml;charset=utf-8,<svg/>';

describe('резолв медіа-референсів у лоадерах', () => {
  it('toImageList: key → URL, data:/http: — незмінно, сміття викинуто', () => {
    expect(toImageList([KEY, DATA, 'https://e.com/a.jpg', '', 42, null])).toEqual([
      `/media/${KEY}`,
      DATA,
      'https://e.com/a.jpg',
    ]);
  });

  it('toImageList на не-масиві лишається порожнім масивом', () => {
    expect(toImageList(null)).toEqual([]);
    expect(toImageList('нема')).toEqual([]);
  });

  it('toBanner резолвить усі три колонки', () => {
    const banner = toBanner({
      image_url: KEY,
      desktop_image_url: DATA,
      mobile_image_url: null,
      buttons: [],
      schedule_days: null,
    } as never);
    expect(banner.image_url).toBe(`/media/${KEY}`);
    expect(banner.desktop_image_url).toBe(DATA);
    expect(banner.mobile_image_url).toBeNull();
  });

  it('toSectionRow і toOptionRow резолвлять image_url', () => {
    expect(toSectionRow({ image_url: KEY } as never).image_url).toBe(`/media/${KEY}`);
    expect(toOptionRow({ image_url: null } as never).image_url).toBeNull();
  });
});
```

- [ ] **Step 2: Прогнати — має впасти**

Run: `pnpm vitest run packages/simplycms/src/storefront/loaders/__tests__/media-resolve.test.ts`
Expected: FAIL — `toSectionRow`/`toOptionRow` не існують, `toImageList` не резолвить.

- [ ] **Step 3: Резолв у `toImageList`**

У `packages/simplycms/src/storefront/loaders/entities/product.ts` замінити:

```ts
import { resolveMediaUrls } from 'simplycms/domain/media';

/**
 * Нормалізує jsonb-колонку `images` у масив ГОТОВИХ URL.
 *
 * 🔴 Резолв саме тут, а не на сторінці: через цю функцію проходять УСІ
 * читання `images` у вітрині (товар, картка, модифікація, деталь) — один
 * шов замість шести. У колонці лежить РЕФЕРЕНС (рішення Е2-1), і саме
 * `resolveMediaUrls` лишає зовнішні URL та `data:`-плейсхолдери як є.
 */
export function toImageList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return resolveMediaUrls(
    value.filter((item): item is string => typeof item === 'string'),
  );
}
```

- [ ] **Step 4: Резолв у `toBanner`**

У `packages/simplycms/src/storefront/loaders/entities/banner.ts` у `toBanner`:

```ts
import { resolveMediaUrl } from 'simplycms/domain/media';
// …
export function toBanner(row: RawBannerRow): Banner {
  return {
    ...row,
    // Три медіа-колонки банера — той самий референс-контракт, що й у товару.
    image_url: resolveMediaUrl(row.image_url),
    desktop_image_url: resolveMediaUrl(row.desktop_image_url),
    mobile_image_url: resolveMediaUrl(row.mobile_image_url),
    buttons: Array.isArray(row.buttons) ? row.buttons.filter(isBannerButton) : [],
    schedule_days: Array.isArray(row.schedule_days) ? row.schedule_days : null,
  };
}
```

- [ ] **Step 5: Додати мапери розділу й опції**

У `packages/simplycms/src/storefront/loaders/entities/section.ts` (після типу `SectionRow`):

```ts
import { resolveMediaUrl } from 'simplycms/domain/media';

/**
 * Доводить рядок розділу до вітрини.
 *
 * 🔴 Мапер заведено заради ОДНОГО поля, і це виправдано: без нього кожен із
 * трьох `.select(sectionColumns)` мусив би памʼятати про резолв сам — саме
 * той клас розсинхрону, який гейт `MEDIA_COLUMNS` і має ловити.
 */
export function toSectionRow(row: SectionRow): SectionRow {
  return { ...row, image_url: resolveMediaUrl(row.image_url) };
}
```

У `packages/simplycms/src/storefront/loaders/entities/property.ts` (після типу `OptionRow`, `property.ts:71-83`):

```ts
import { resolveMediaUrl } from 'simplycms/domain/media';

/** Те саме для опції властивості — єдина медіа-колонка `image_url`. */
export function toOptionRow(row: OptionRow): OptionRow {
  return { ...row, image_url: resolveMediaUrl(row.image_url) };
}
```

- [ ] **Step 6: Провести рядки через мапери**

- `packages/simplycms/src/storefront/loaders/sections.ts` — обидва `.select(sectionColumns)` (рядки 19 і 31): результат обгорнути `.map(toSectionRow)` (для одиничного рядка — `toSectionRow(row)`).
- `packages/simplycms/src/storefront/loaders/properties.ts:72` — `.select(optionColumns)` → `.map(toOptionRow)`.
- `packages/simplycms/src/storefront/loaders/property-option.ts:42` — `.select({ property: propertyColumns, option: optionColumns })` → опцію пропустити через `toOptionRow`.

- [ ] **Step 7: Провести відгуки через `toImageList`**

У `packages/simplycms/src/storefront/loaders/reviews.ts:59` замінити

```ts
    images: Array.isArray(row.images) ? (row.images as string[]) : [],
```

на

```ts
    // Через спільну функцію, а не власним кастом: інакше зображення відгуку
    // лишилось би єдиною медіа-колонкою без резолву.
    images: toImageList(row.images),
```

(додати імпорт `toImageList` з `./entities/product`).

- [ ] **Step 8: Прогнати тести**

Run: `pnpm vitest run packages/simplycms/src/storefront/loaders/__tests__/media-resolve.test.ts`
Expected: PASS.

- [ ] **Step 9: Перевірити, що вітрина не змінилась на демо-даних**

```bash
pnpm vitest run --config vitest.schema.config.ts packages/simplycms/test-harness/pg/__tests__/storefront-showcase.test.ts packages/simplycms/test-harness/pg/__tests__/storefront-loaders.test.ts
```
Expected: PASS без правок — демо не містить референсів, тож усі значення проходять незмінними. Червоне тут означає, що резолв зачепив форму, яку мав лишити як є: **не правь тест**, знайди форму й додай її в `ALREADY_ABSOLUTE`.

- [ ] **Step 10: Гейт задачі**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm test:schema
```
Expected: PASS, включно з `media-columns-coverage`.

- [ ] **Step 11: Коміт**

```bash
git add packages/simplycms/src/storefront/loaders
git commit -m "feat(k3-e2): вітрина резолвить медіа-референси в URL — один шов на колонку"
```

---

## Task 7: `media.write`, serverFn адмінки і `ImageUpload` на порт

**Files:**
- Modify: `packages/simplycms/src/auth/authz.ts:29-39,57-68`
- Modify: `eslint.tier-zones.mjs` (upward-виняток `storage` для `admin-server`)
- Create: `packages/simplycms/src/admin-server/impl/operations/media.ts`
- Create: `packages/simplycms/src/admin-server/impl/__tests__/media.test.ts`
- Modify: `packages/simplycms/src/admin-server/impl/index.ts`
- Modify: `packages/simplycms/src/admin-server/index.ts`
- Modify: `packages/simplycms/src/admin/components/ImageUpload.tsx`

**Interfaces:**
- Consumes: Task 3 — `writeMedia`/`eraseMedia`; Task 1 — `resolveMediaUrl`.
- Produces:
  - `Operation` += `'media.write'`
  - `export const uploadMedia: ServerFn` — `FormData` (`file`, `entityType`, опційний `entityId`) → `{ ref: string; url: string }`
  - `export const deleteMedia: ServerFn` — `{ ref: string }` → `{ removed: boolean }`

**🔴 Межа цієї задачі, названа чесно.** `ImageUpload` переписується на порт і покривається юнітами, але **всі пʼять його сторінок-споживачів** (`ProductEdit`, `SectionEdit`, `BannerEdit`, `PropertyOptionEdit`, `ProductModifications`) читають і пишуть дані через `supabase-js` і на чистому Postgres не працюють до хвиль Е3–Е6. Живого доказу «зображення товару працює» в Е2 бути не може — DoD К3 п.6 закривається хвилею каталогу. Робимо це зараз, бо (а) інакше хвиля каталогу тягла б storage-борг усередину себе, і (б) лінт-заборона Task 8 неможлива, поки `ImageUpload` кличе `supabase.storage`.

- [ ] **Step 1: Написати падаючий тест операції**

`packages/simplycms/src/admin-server/impl/__tests__/media.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { AUTHZ_MATRIX, can } from 'simplycms/auth';
import { parseUploadForm } from '../operations/media';

describe('media.write у матриці authz', () => {
  it('дозволена лише адміну', () => {
    expect(AUTHZ_MATRIX['media.write']).toEqual({ admin: 'any' });
    expect(can({ userId: 'u', roles: ['admin'] }, 'media.write')).toBe(true);
    expect(can({ userId: 'u', roles: ['user'] }, 'media.write')).toBe(false);
    expect(can({ userId: null, roles: [] }, 'media.write')).toBe(false);
  });
});

describe('parseUploadForm', () => {
  const png = () =>
    new File([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])], 'a.png');

  const form = (entries: Record<string, string | File>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(entries)) fd.set(k, v);
    return fd;
  };

  it('віддає байти, просніфаний MIME і сутність', async () => {
    const parsed = await parseUploadForm(
      form({ file: png(), entityType: 'product', entityId: 'ab000000-0000-4000-8000-000000000000' }),
    );
    expect(parsed.mime).toBe('image/png');
    expect(parsed.entityType).toBe('product');
    expect(parsed.entityId).toBe('ab000000-0000-4000-8000-000000000000');
  });

  it('entityId відсутній → null (файл ще не привʼязаний; привʼязка — К4)', async () => {
    const parsed = await parseUploadForm(form({ file: png(), entityType: 'banner' }));
    expect(parsed.entityId).toBeNull();
  });

  it.each([
    ['без файлу', form({ entityType: 'product' })],
    ['без entityType', form({ file: png() })],
    ['entityType поза allowlist', form({ file: png(), entityType: 'orders' })],
    ['entityId не uuid', form({ file: png(), entityType: 'product', entityId: 'нi' })],
  ])('відбиває: %s', async (_label, fd) => {
    await expect(parseUploadForm(fd)).rejects.toThrow();
  });

  it('відбиває SVG навіть із розширенням .png', async () => {
    const svg = new File([new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')], 'a.png');
    await expect(parseUploadForm(form({ file: svg, entityType: 'product' }))).rejects.toThrow(
      /format/i,
    );
  });

  it('відбиває файл понад стелю розміру', async () => {
    const big = new File([new Uint8Array(11 * 1024 * 1024)], 'big.png');
    await expect(parseUploadForm(form({ file: big, entityType: 'product' }))).rejects.toThrow(
      /large/i,
    );
  });
});
```

- [ ] **Step 2: Прогнати — має впасти**

Run: `pnpm vitest run packages/simplycms/src/admin-server/impl/__tests__/media.test.ts`
Expected: FAIL — ні `media.write` у матриці, ні модуля `../operations/media`.

- [ ] **Step 3: Завести операцію в матриці authz**

У `packages/simplycms/src/auth/authz.ts` у `Operation` додати `| 'media.write'`, у `AUTHZ_MATRIX` — рядок:

```ts
  // Завантаження й прибирання файлів адмінкою (рішення Е2-5). Не
  // `catalog.write`: банери, розділи й відгуки каталогом не є, і менеджер
  // контенту без права на каталог мусить мати змогу завантажити банер.
  // Одна операція на upload і delete: прибрати власне завантаження — той
  // самий акт, а не окреме право.
  'media.write': { admin: 'any' },
```

- [ ] **Step 4: Написати операції адмінки**

`packages/simplycms/src/admin-server/impl/operations/media.ts`:

```ts
import { z } from 'zod';
import { dbRoleForSubject, requireGrant } from 'simplycms/auth';
import { withActor } from 'simplycms/db';
import { MEDIA_URL_BASE, resolveMediaUrl } from 'simplycms/domain/media';
import {
  eraseMedia,
  sniffImageMime,
  writeMedia,
  type MediaMime,
} from 'simplycms/storage';

/** Стеля розміру. Start буферизує тіло цілком — межа мусить бути явною. */
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Сутності, до яких адмінка сміє привʼязати файл.
 *
 * 🔴 Allowlist, а не вільний рядок: `entity_type` іде в БД і потім у
 * предикати обліку. Довільне значення від клієнта зробило б облік
 * незведéним, а sweep орфанів (К4) — сліпим.
 */
const ENTITY_TYPES = [
  'product',
  'product_modification',
  'section',
  'banner',
  'property_option',
] as const;

const entityIdSchema = z.string().uuid().nullable();

export interface ParsedUpload {
  readonly bytes: Uint8Array;
  readonly mime: MediaMime;
  readonly entityType: (typeof ENTITY_TYPES)[number];
  readonly entityId: string | null;
}

/**
 * Розбір форми завантаження. Винесено з хендлера окремою чистою функцією
 * саме заради тестів: сам хендлер без сесії й БД не запускається.
 *
 * 🔴 Тексти помилок англійською: це серверна діагностика, яку клієнт мапить
 * у власні рядки каталогу, а не рядок інтерфейсу.
 */
export async function parseUploadForm(data: FormData): Promise<ParsedUpload> {
  const file = data.get('file');
  if (!(file instanceof File)) throw new Error('media/no-file');
  if (file.size > MAX_BYTES) throw new Error('media/too-large');

  const entityTypeRaw = data.get('entityType');
  if (typeof entityTypeRaw !== 'string') throw new Error('media/no-entity-type');
  const entityType = ENTITY_TYPES.find((t) => t === entityTypeRaw);
  if (!entityType) throw new Error('media/bad-entity-type');

  const entityIdRaw = data.get('entityId');
  const entityId = entityIdSchema.parse(
    typeof entityIdRaw === 'string' && entityIdRaw !== '' ? entityIdRaw : null,
  );

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffImageMime(bytes);
  if (!mime) throw new Error('media/bad-format');

  return { bytes, mime, entityType, entityId };
}

/** Завантажити файл від імені адміна. */
export async function uploadMediaOp({
  data,
}: {
  data: FormData;
}): Promise<{ ref: string; url: string }> {
  // 🔴 Перший рубіж — ЗАВЖДИ до withActor (К3-13): `app_admin` вмикається
  // лише після типізованого «так».
  const { subject } = await requireGrant('media.write');
  const parsed = await parseUploadForm(data);

  return withActor(
    { role: dbRoleForSubject(subject), userId: subject.userId ?? undefined },
    async (db) => {
      const record = await writeMedia(db, {
        bytes: parsed.bytes,
        mime: parsed.mime,
        entityType: parsed.entityType,
        entityId: parsed.entityId,
        uploadedBy: subject.userId,
      });
      return { ref: record.ref, url: resolveMediaUrl(record.ref, MEDIA_URL_BASE)! };
    },
  );
}

export const deleteMediaInput = z.object({ ref: z.string().min(1).max(200) });

/** Прибрати файл за референсом. Зовнішній URL → `removed: false`, без збою. */
export async function deleteMediaOp({
  data,
}: {
  data: z.infer<typeof deleteMediaInput>;
}): Promise<{ removed: boolean }> {
  const { subject } = await requireGrant('media.write');
  return withActor(
    { role: dbRoleForSubject(subject), userId: subject.userId ?? undefined },
    async (db) => ({ removed: await eraseMedia(db, data.ref) }),
  );
}
```

🔴 Підпис звірено: `requireGrant(operation)` повертає `RequestGrant = { subject, scope }` (`auth/authz-request.ts:47-58`) і сам ставить `setResponseStatus(403)` перед прокиданням `AuthzError` — деструктуризація `{ subject }` вище коректна. 🔴 `requireGrant` **не можна** кликати зсередини відкритої транзакції: `readSessionSubject` бере власне зʼєднання, і на вичерпаному пулі це self-deadlock (докблок `resolveRequestGrant`). Порядок «грант → `withActor`» тут не стилістичний.

- [ ] **Step 4a: Відкрити `admin-server` доступ до `storage`**

🔴 `admin-server` і `storage` — ОБИДВА T2, тож імпорт `simplycms/storage`
звідти тір-зона трактує як «на свій шар» і валить. Це не помилка зони:
вона вимагає, щоб кожне таке ребро було названим.

🔴 **А от `storefront` винятку НЕ потребує — і це рішення, а не збіг.**
Оркестрація аватара (вставка рядка `media`, запис файлу, оновлення профілю,
`operator`-видалення старого) живе в `core/lib/profile-avatar.ts` — це **T5**,
тож його імпорт `simplycms/storage` (T2) іде вниз по шарах і легальний без
жодного винятку. Класти ту саму оркестрацію в `storefront/loaders` (T2)
означало б відкрити `storefront: ['db','auth','storage']` — тобто навчити
SSR-лоадери вітрини про файлову систему. Лоадери читають дані; файли пише
serverFn. Форма обрана саме тому (підтверджено архітектором 2026-09-13).

У `eslint.tier-zones.mjs` розширити рядок `admin-server`:

```js
  // `storage` у винятку з тієї ж причини, що `db` і `auth`: канал до файлів
  // один — порт, і заборона власного тіру виштовхнула б адмінку на прямий
  // `node:fs`, тобто рівно туди, куди не можна.
  ['src/admin-server', 2, 'admin-server', ['db', 'auth', 'storage']],
```

🔴 Власний запис зони `['src/storage', 2, 'storage', ['db']]` уже додано
в Task 2 Step 17 — без нього нове дерево лишалось би поза зонами взагалі,
і імпорт УГОРУ звідти (наприклад `storage → admin-server`) лінт не побачив
би. Перевір, що обидва записи на місці:

```bash
grep -n "'src/storage'\|'src/admin-server'" eslint.tier-zones.mjs
```
Expected: два рядки — `['src/storage', 2, 'storage', ['db']]` і
`['src/admin-server', 2, 'admin-server', ['db', 'auth', 'storage']]`.

Прогнати `pnpm lint` і `pnpm vitest run tests/tier-boundary.test.ts`.
Expected: PASS. 🔴 Негативний контроль зони `storage` (прогнати руками, не
комітити): додай у `packages/simplycms/src/storage/index.ts` рядок
`import 'simplycms/admin-server';` (імпорт угору з T2 у T2 без винятку),
прожени `pnpm lint` — має бути error від тір-зони; прибери рядок.

- [ ] **Step 5: Реекспортувати з `impl/index.ts` і додати serverFn**

У `packages/simplycms/src/admin-server/impl/index.ts`:

```ts
export {
  deleteMediaInput,
  deleteMediaOp,
  parseUploadForm,
  uploadMediaOp,
} from './operations/media';
```

У `packages/simplycms/src/admin-server/index.ts` — топ-рівневі const (К3-4′), bare-субшлях у імпорті:

```ts
import {
  deleteMediaInput,
  deleteMediaOp,
  uploadMediaOp,
} from 'simplycms/admin-server/impl';

// 🔴 Валідатор — функція, а не Zod-схема: `inputValidator` зі схемою не
// приймає FormData (Start типізує цю гілку окремо). Вміст форми перевіряє
// `parseUploadForm` усередині операції.
export const uploadMedia = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown): FormData => {
    if (!(data instanceof FormData)) {
      throw new Error('[simplycms] uploadMedia expects FormData.');
    }
    return data;
  })
  .handler(uploadMediaOp);

export const deleteMedia = createServerFn({ method: 'POST' })
  .inputValidator(deleteMediaInput)
  .handler(deleteMediaOp);
```

- [ ] **Step 6: Прогнати тести операцій**

Run: `pnpm vitest run packages/simplycms/src/admin-server/impl/__tests__/media.test.ts`
Expected: PASS.

- [ ] **Step 7: Прогнати гейти форми serverFn**

```bash
pnpm lint
pnpm vitest run tests/handler-canon.test.ts tests/eslint-rules/server-fn-top-level.test.ts
```
Expected: PASS. 🔴 Якщо `handler-canon` чи `server-fn-top-level` червоніють на FormData-валідаторі — **не глуши правило**: додай передбачений ним якір-виняток із причиною в коментарі й зафіксуй це в звіті задачі як зміну контракту гейта (архітектор назвав саме цей ризик).

- [ ] **Step 8: Переписати `ImageUpload` на порт**

У `packages/simplycms/src/admin/components/ImageUpload.tsx`:

1. Прибрати `import { useSupabaseClient } from 'simplycms/supabase/SupabaseProvider'` і рядок `const supabase = useSupabaseClient();`.
2. Додати:

```ts
import { deleteMedia, uploadMedia } from 'simplycms/admin-server';
import { resolveMediaUrl } from 'simplycms/domain/media';
```

3. Props: замінити `folder`/`bucket` на `entityType: 'product' | 'product_modification' | 'section' | 'banner' | 'property_option'` і опційний `entityId?: string | null`. Оновити пʼять місць виклику (`ProductEdit.tsx:298`, `SectionEdit.tsx:273`, `BannerEdit.tsx:281,291,305`, `PropertyOptionEdit.tsx:287`, `ProductModifications.tsx:410`), передавши відповідний `entityType`.
4. `uploadFile`:

```ts
  const uploadFile = useCallback(
    async (file: File): Promise<string | null> => {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          variant: 'destructive',
          title: t('admin.products.upload.tooLarge'),
          description: t('admin.products.upload.maxSize'),
        });
        return null;
      }
      const body = new FormData();
      body.set('file', file);
      body.set('entityType', entityType);
      if (entityId) body.set('entityId', entityId);
      try {
        // 🔴 Повертається РЕФЕРЕНС, а не URL: у колонку сутності лягає він
        // (рішення Е2-1), а `url` — лише для прев’ю в цій формі.
        const { ref } = await uploadMedia({ data: body });
        return ref;
      } catch (error) {
        toast({
          variant: 'destructive',
          title: t('admin.products.upload.failed'),
          description:
            error instanceof Error && error.message === 'media/bad-format'
              ? t('admin.products.upload.allowedFormats')
              : undefined,
        });
        return null;
      }
    },
    [entityType, entityId, toast, t],
  );
```

5. `removeImage` — більше НЕ парсить URL:

```ts
  const removeImage = async (index: number) => {
    const ref = images[index];
    onImagesChange(images.filter((_, i) => i !== index));
    // Зовнішній URL рядка `media` не має — порт чесно поверне `removed: false`,
    // а не впаде; тому окремої гілки на `https:` тут не треба.
    try {
      await deleteMedia({ data: { ref } });
    } catch {
      // Невдале прибирання лишає орфана — його змете sweep К4. Форму це
      // не блокує: референс із сутності вже прибрано.
    }
  };
```

6. Прев’ю в гриді: `src={resolveMediaUrl(url) ?? undefined}` (у гриді тепер референси, не URL).
7. Прибрати перевірку розширення за іменем файлу (`allowedExts`) — MIME визначає сервер за байтами; лишити `accept` на інпуті як UX-підказку, додавши `image/avif`.

- [ ] **Step 9: Перевірити, що `supabase.storage` в `ImageUpload` не лишилось**

```bash
grep -n "supabase" packages/simplycms/src/admin/components/ImageUpload.tsx
```
Expected: жодного збігу.

- [ ] **Step 10: Гейт задачі**

```bash
pnpm lint && pnpm build && pnpm typecheck && pnpm test
pnpm build:packages && pnpm test:packaging && pnpm pilot:pack
```
Expected: PASS. 🔴 `pilot:pack` — бо `admin-server` дістав нову поверхню, і Gate C стереже, що `admin-server/impl` (а тепер і `storage`) не поїхали в клієнтський бандл.

- [ ] **Step 11: Коміт**

```bash
git add packages/simplycms/src/auth/authz.ts packages/simplycms/src/admin-server \
        packages/simplycms/src/admin eslint.tier-zones.mjs
git commit -m "feat(k3-e2): media.write, serverFn завантаження адмінки і ImageUpload на порт сховища"
```

---

## Task 8: Лінт-ратчет — прямі виклики storage поза портом

**Files:**
- Create: `tests/storage-direct-calls.test.ts`
- Create: `eslint-rules/no-direct-storage.mjs`
- Create: `tests/eslint-rules/no-direct-storage.test.ts`
- Modify: `eslint.config.mjs`
- Modify: `.github/instructions/storage.instructions.md`

**Interfaces:**
- Consumes: Task 7 (після нього прямий виклик лишається рівно один).
- Produces: `export const STORAGE_DIRECT_CALL_EXEMPTIONS: readonly string[]`

- [ ] **Step 1: Виміряти фактичний залишок**

```bash
grep -rn "\.storage\.from(\|supabase\.storage\|@supabase/storage-js" \
  --include=*.ts --include=*.tsx packages/simplycms/src/
```
Expected після Task 7: рівно один файл — `admin/pages/ReviewDetail.tsx`. 🔴 Якщо файлів більше — **не піднімай список виїмок**, з'ясуй, звідки взявся новий виклик; список може лише скорочуватись.

- [ ] **Step 2: Написати падаючий ратчет-тест**

`tests/storage-direct-calls.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { sourceFiles } from '../packages/simplycms/test-harness/pg/insert-scan';

const SRC = resolve(import.meta.dirname, '../packages/simplycms/src');

/**
 * Ратчет прямих викликів сховища поза портом `simplycms/storage`.
 *
 * 🔴 Список може тільки СКОРОЧУВАТИСЬ. `ReviewDetail.tsx` лишається тут не
 * тому, що виклик правильний, а тому, що сторінка цілком мертва: вона читає
 * й пише через `supabase-js` і на чистому Postgres не працює. Її перепише
 * хвиля відгуків (Е4–Е6) разом із цим викликом. Переписати її «заодно» в Е2
 * означало б тягнути в storage-етап половину хвилі сутностей.
 *
 * 🔴 Тест дублює лінт-правило навмисно: правило бачить лише те, що ESLint
 * парсить у своїй зоні, а цей скан ходить по ФАЙЛАХ — тож новий виклик у
 * теці, яку зона колись перестане покривати, не проскочить мовчки.
 */
export const STORAGE_DIRECT_CALL_EXEMPTIONS = [
  'admin/pages/ReviewDetail.tsx',
] as const;

const DIRECT_CALL = /\.storage\.from\(|supabase\.storage|@supabase\/storage-js/;

describe('прямі виклики сховища поза портом', () => {
  const offenders = sourceFiles(SRC)
    .filter((file) => DIRECT_CALL.test(readFileSync(file, 'utf8')))
    .map((file) => relative(SRC, file).replaceAll('\\', '/'));

  it('поза списком виїмок прямих викликів немає', () => {
    expect(
      offenders.filter(
        (f) => !STORAGE_DIRECT_CALL_EXEMPTIONS.includes(f as never),
      ),
      'новий прямий виклик сховища — використай simplycms/storage через serverFn',
    ).toEqual([]);
  });

  it('список виїмок не містить мертвих записів', () => {
    expect(
      STORAGE_DIRECT_CALL_EXEMPTIONS.filter((f) => !offenders.includes(f)),
      'файл переписано — прибери його зі списку, список лише скорочується',
    ).toEqual([]);
  });
});
```

🔴 Підпис звірено: `sourceFiles(dir: string): string[]` (`test-harness/pg/insert-scan.ts:75-79`) — рекурсивний обхід теки з фільтром `.ts`/`.tsx`, повертає абсолютні шляхи. Виклик вище коректний як є.

- [ ] **Step 3: Прогнати — має пройти на обох тестах**

Run: `pnpm vitest run tests/storage-direct-calls.test.ts`
Expected: PASS.

- [ ] **Step 4: Негативний контроль ратчета (прогнати руками, не комітити)**

Додай у будь-який файл `packages/simplycms/src/admin/pages/Users.tsx` рядок-коментар `// supabase.storage` і прожени тест.
Expected: FAIL із `['admin/pages/Users.tsx']`. Прибери рядок.

- [ ] **Step 5: Написати кастомне правило (а НЕ `no-restricted-*`)**

🔴 **Чому саме кастомне правило.** Спокуса — додати блок із
`no-restricted-syntax` і `no-restricted-imports` на
`packages/simplycms/src/**`. Це зламало б **два** наявні гейти: flat config
ЗАМІЩУЄ опції правила цілком, а не доливає, тож такий блок стер би
i18n-селектори на `src/admin/**` і `src/*-ui/**` **і** тір-зони, які
тримаються саме на `no-restricted-imports` для тих самих файлів. Репозиторій
має усталену відповідь на цей клас — пʼять власних правил у `eslint-rules/`
з ОКРЕМИМ іменем плагіна (докблок при `simplycms-serverfn`,
`eslint.config.mjs:363-366` пояснює рівно це). Шосте правило нічого не
заміщує за побудовою.

🔴 Критерій «власне правило чи готовий плагін» із Додатка Б спеки К2-Е0 тут
виконано: «прямих storage-викликів немає» — це НАШ інваріант, як
`server-only-relative`, а не публічний стандарт, як a11y. Власні інваріанти
живуть у `eslint-rules/`; готовий плагін підключається лише там, де правило
загальновідоме.

`eslint-rules/no-direct-storage.mjs`:

```js
/**
 * Файли — лише через порт `simplycms/storage` за serverFn (рішення Е2-9).
 *
 * 🔴 Власне правило, а не `no-restricted-syntax`: блок із цим правилом на
 * `packages/simplycms/src/**` замістив би i18n-селектори адмінки й воронки
 * (flat config замінює опції правила цілком). Окреме імʼя плагіна робить
 * зону адитивною.
 *
 * Ловить три форми: `supabase.storage`, `<що-завгодно>.storage.from(...)`
 * та імпорт `@supabase/storage-js`.
 */
/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      direct:
        'Прямий виклик сховища заборонений — завантаження й видалення лише ' +
        'через simplycms/storage за serverFn (рішення Е2-9, етап К3-Е2).',
    },
  },
  create(context) {
    const report = (node) => context.report({ node, messageId: 'direct' });
    return {
      // supabase.storage / client.storage — доступ до властивості
      "MemberExpression[computed=false][property.name='storage']"(node) {
        report(node);
      },
      // x['storage'] — обхід крізь обчислений доступ
      "MemberExpression[computed=true][property.value='storage']"(node) {
        report(node);
      },
      "ImportDeclaration[source.value='@supabase/storage-js']"(node) {
        report(node);
      },
    };
  },
};
```

🔴 Селектор `property.name='storage'` широкий навмисно: у пакеті ядра немає
жодної легальної властивості з таким іменем (перевірено Step 1 — єдині збіги
саме в `ReviewDetail.tsx`), а вузький селектор «лише `supabase.storage`»
пропустив би `const s = getClient(); s.storage.from(...)`.

- [ ] **Step 6: Написати машинні фікстури правила**

`tests/eslint-rules/no-direct-storage.test.ts` — за зразком сусіднього
`tests/eslint-rules/server-fn-top-level.test.ts` (Linter API):

```ts
import { describe, expect, it } from 'vitest';
import { Linter } from 'eslint';
import rule from '../../eslint-rules/no-direct-storage.mjs';

const linter = new Linter();
const lint = (code: string) =>
  linter.verify(code, {
    plugins: { s: { rules: { 'no-direct-storage': rule } } },
    rules: { 's/no-direct-storage': 'error' },
    languageOptions: { ecmaVersion: 2024, sourceType: 'module' },
  });

describe('no-direct-storage', () => {
  it.each([
    ['прямий supabase.storage', 'await supabase.storage.from("b").remove([k]);'],
    ['через змінну', 'const c = get(); c.storage.from("b").upload(k, f);'],
    ['обчислений доступ', 'const c = get(); c["storage"].from("b");'],
    ['імпорт storage-js', 'import { X } from "@supabase/storage-js";'],
  ])('валить: %s', (_label, code) => {
    expect(lint(code)).toHaveLength(1);
  });

  it.each([
    ['порт', 'import { writeMedia } from "simplycms/storage";'],
    ['serverFn адмінки', 'await uploadMedia({ data: body });'],
    ['рядок "storage" як значення', 'const kind = "storage";'],
    ['чужа таблиця БД', 'await db.select().from(media);'],
  ])('не валить: %s', (_label, code) => {
    expect(lint(code)).toHaveLength(0);
  });
});
```

- [ ] **Step 6a: Прогнати фікстури**

Run: `pnpm vitest run tests/eslint-rules/no-direct-storage.test.ts`
Expected: PASS (8 кейсів).

- [ ] **Step 6b: Підключити правило зоною**

У `eslint.config.mjs` — імпорт поруч із рештою (рядок ≈12):

```js
import noDirectStorage from './eslint-rules/no-direct-storage.mjs';
```

і новий блок після блоку `simplycms-serverfn`:

```js
  // Файли — лише через порт (рішення Е2-9). Окреме імʼя плагіна
  // (`simplycms-storage`) — щоб опції не зливались із сусідніми правилами.
  // 🔴 `ignores` — ратчет: `ReviewDetail.tsx` мертвий і переписується
  // хвилею відгуків разом із цим викликом. Список дзеркалиться в
  // `tests/storage-direct-calls.test.ts` і може тільки скорочуватись.
  {
    files: ['packages/simplycms/src/**/*.{ts,tsx}'],
    ignores: ['packages/simplycms/src/admin/pages/ReviewDetail.tsx'],
    plugins: {
      'simplycms-storage': { rules: { 'no-direct-storage': noDirectStorage } },
    },
    rules: { 'simplycms-storage/no-direct-storage': 'error' },
  },
```

- [ ] **Step 6c: Негативний контроль зони — і i18n-зони теж**

```bash
# 1. Нове правило спрацьовує на реальному файлі
printf '\nconst _x = supabase.storage;\n' >> packages/simplycms/src/admin/pages/Users.tsx
pnpm lint 2>&1 | grep -c 'simplycms-storage/no-direct-storage'
```
Expected: `1`.

```bash
# 2. 🔴 i18n-зона на ТОМУ Ж файлі жива — доказ, що нова зона нічого не
#    замістила (саме цей клас поломки й мотивував кастомне правило)
printf '\n// контроль: <span>Перевірка зони</span>\n' >> packages/simplycms/src/admin/pages/Users.tsx
pnpm lint 2>&1 | grep -c 'no-restricted-syntax'
```
Expected: попередній рівень не впав до нуля — i18n-селектори на місці.

```bash
git checkout -- packages/simplycms/src/admin/pages/Users.tsx
```
Обидва результати зафіксувати у звіті задачі.

- [ ] **Step 7: Переписати інструкцію по сховищу**

`.github/instructions/storage.instructions.md` — повністю замінити (файл досі описує Supabase Storage як архітектуру):

```markdown
---
applyTo: "packages/simplycms/src/**/*.{ts,tsx},src/**/*.{ts,tsx}"
description: "Робота з файловим сховищем: порт simplycms/storage, драйвер local-fs, медіа-референси"
---

# Storage Rules

## Архітектура (V2, етап К3-Е2)

Файли живуть за портом **`simplycms/storage`** — server-only піддерево.
Драйвер за замовчуванням — `local-fs` (диск, корінь із `MEDIA_ROOT`,
дефолт `./.data/media`); `s3` приходить у К4 як друга реалізація того
самого інтерфейсу `MediaStorageDriver`.

**У БД лежить РЕФЕРЕНС, не URL.** Референс — це storage key
(`ab/<uuid>.<ext>`) для завантаженого файлу; зовнішні `https?:`, вбудовані
`data:` і корене-відносні `/…` проходять як є. Резолв у URL — одна чиста
функція `resolveMediaUrl` із `simplycms/domain/media`.

## ✅ ALWAYS

- Завантаження й видалення — **лише serverFn**: `uploadMedia`/`deleteMedia`
  (`simplycms/admin-server`) для адмінки, `uploadMyAvatar`/`removeMyAvatar`
  (`simplycms/core/lib/profile-avatar`) для кабінету.
- Рядок `media` і файл пишуться **однією транзакцією актора** —
  `writeMedia(db, …)`; видалення — `eraseMedia(db, ref)`, СПЕРШУ обʼєкт,
  ПОТІМ рядок.
- MIME визначається **магічними байтами** (`sniffImageMime`), не
  розширенням і не `file.type`.
- Вітрина резолвить референс **на сервері**, у лоадері чи мапері сутності —
  щоб контракт тем v3 отримував готові URL-рядки.
- Нова медіа-колонка в схемі → запис у `MEDIA_COLUMNS`
  (`simplycms/domain/media`) + резолв при читанні. Гейт —
  `schema/__tests__/media-columns-coverage.test.ts`.
- `<img>` на вітрині: `loading="lazy"`, явні `width`/`height` або
  `aspect-ratio`.

## ❌ NEVER

- Не викликай `supabase.storage` і не імпортуй `@supabase/storage-js` —
  правило `simplycms-storage/no-direct-storage` і ратчет
  `tests/storage-direct-calls.test.ts` це валять. Єдина виїмка —
  `admin/pages/ReviewDetail.tsx` (мертва сторінка, переписується хвилею
  відгуків).
- Не приймай **SVG** на завантаження: він несе скрипти. Allowlist —
  png/jpeg/webp/gif/avif.
- Не клади URL у колонку сутності — лише референс.
- Не перезаписуй ключ: обʼєкти іммутабельні, нове зображення = новий ключ
  (на цьому тримається `Cache-Control: immutable` роздачі).
- Не читай `MEDIA_ROOT` на модуль-рівні — лише в рантаймі, всередині
  функції (контракт серверного env).

## ℹ️ Де шукати деталі

- `packages/simplycms/src/storage/` — порт, драйвер, запис, роздача.
- `packages/simplycms/src/domain/media.ts` — референси й резолв.
- `packages/simplycms/routes/storefront/media/$.tsx` — роздача `/media/*`.
- План етапу — `docs/superpowers/plans/2026-09-13-v2-k3-e2-storage-minimum.md`.
```

- [ ] **Step 8: Гейт задачі**

```bash
pnpm lint && pnpm typecheck && pnpm test
```
Expected: PASS, кількість warnings не зросла проти заміру Task 1.

- [ ] **Step 9: Коміт**

```bash
git add eslint.config.mjs eslint-rules/no-direct-storage.mjs \
        tests/eslint-rules/no-direct-storage.test.ts \
        tests/storage-direct-calls.test.ts \
        .github/instructions/storage.instructions.md
git commit -m "feat(k3-e2): лінт-ратчет прямих викликів сховища + інструкція під порт"
```

---

## Task 9: `live:smoke`, доки й DoD етапу

**Files:**
- Create: `scripts/live-smoke/avatar.mjs`
- Modify: `scripts/live-smoke/funnel.mjs`
- Modify: `CLAUDE.md`
- Modify: `docs/tasks/platform-roadmap.md`
- Modify: `docs/tasks/v2-state-map.md`
- Modify: `docs/architecture/test-contours.md`

**Interfaces:**
- Consumes: усі попередні задачі.
- Produces: DoD-звіт етапу.

- [ ] **Step 1: Написати модуль кроку аватара**

🔴 Окремий файл, а не вставка в `funnel.mjs`: цей файл уже в каноні 150 рядків
і вже раз розділявся саме з цієї причини (`register.mjs`). Крок аватара
самодостатній і від воронки покупки не залежить — тому виноситься одразу.

`scripts/live-smoke/avatar.mjs`:

```js
/**
 * Крок аватара — ЄДИНИЙ живий доказ порту сховища (етап К3-Е2).
 *
 * 🔴 Тести цього не доводять і не можуть: у них немає ні реального
 * multipart-тіла, ні реальної файлової системи сервера, ні роздачі роутом.
 * Тут проходить увесь ланцюг: браузер → serverFn → файл на диску →
 * `/media/<key>` → `<img>` — і те, що в колонці профілю лежить РЕФЕРЕНС,
 * а не URL (рішення Е2-1), перевіряється прямим SQL.
 *
 * Виклик — після `register`, поки покупець залогінений.
 */
import { sql } from './sql.mjs';

/** Найменший валідний PNG: сигнатура + IHDR + мінімальний IDAT. */
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
    '1f15c4890000000a49444154789c6300010000050001',
  'hex',
);

export async function runAvatarStep({ page, base, dbUrl, check }) {
  await page.goto(`${base}/profile/settings`, { waitUntil: 'networkidle' });
  await page.setInputFiles('[data-testid="avatar-file-input"]', {
    name: 'avatar.png',
    mimeType: 'image/png',
    buffer: PNG,
  });

  const src = await page
    .locator('img[src^="/media/"]')
    .first()
    .getAttribute('src', { timeout: 10_000 });
  check('аватар: <img> отримав /media-URL', Boolean(src), src ?? '—');

  const served = await page.request.get(`${base}${src}`);
  const headers = served.headers();
  check(
    'аватар: роздача — 200 image/png із nosniff та immutable',
    served.status() === 200 &&
      headers['content-type'] === 'image/png' &&
      headers['x-content-type-options'] === 'nosniff' &&
      (headers['cache-control'] ?? '').includes('immutable'),
    `${served.status()} ${headers['content-type']} ${headers['cache-control']}`,
  );

  const [profile] = await sql(
    dbUrl,
    `select avatar_url from public.profiles where avatar_url is not null limit 1`,
  );
  const ref = profile?.avatar_url ?? '';
  check(
    'аватар: у profiles.avatar_url РЕФЕРЕНС, не URL',
    /^[0-9a-f]{2}\/[0-9a-f-]{36}\.png$/.test(ref),
    ref || '—',
  );
  check('аватар: URL = база + референс', src === `/media/${ref}`, `${src} vs /media/${ref}`);

  const [row] = await sql(
    dbUrl,
    `select storage_key, size_bytes, mime_type
       from public.media where entity_type = 'avatar'`,
  );
  check(
    'аватар: рядок media несе фактичний розмір і MIME',
    row?.storage_key === ref &&
      row?.size_bytes === PNG.length &&
      row?.mime_type === 'image/png',
    `${row?.size_bytes} Б / ${row?.mime_type}`,
  );

  // Видалення — друга половина інваріанта Е2-7: спершу обʼєкт, потім рядок.
  await page.getByRole('button', { name: 'Видалити фото' }).click();
  await page.waitForFunction(
    () => !document.querySelector('img[src^="/media/"]'),
    undefined,
    { timeout: 10_000 },
  );
  const gone = await page.request.get(`${base}/media/${ref}`);
  const [left] = await sql(
    dbUrl,
    `select count(*)::int as n from public.media where storage_key = $1`,
    [ref],
  );
  check(
    'аватар: видалення прибрало і обʼєкт, і рядок',
    gone.status() === 404 && left.n === 0,
    `GET ${gone.status()}, рядків ${left.n}`,
  );
}
```

- [ ] **Step 2: Підключити крок в оркестрації**

У `scripts/live-smoke/funnel.mjs` — імпорт і виклик одразу після `register`:

```js
import { runAvatarStep } from './avatar.mjs';
// …
  await register(page, base);
  await runAvatarStep({ page, base, dbUrl, check });
```

🔴 Саме тут, а не в кінці: сторінка кабінету вимагає сесії, і після
скасування замовлення воронка вже не гарантує стан кабінету.

- [ ] **Step 3: Прогнати живий смок**

```bash
pnpm exec playwright install chromium   # якщо ще не стоїть
PG_HARNESS_URL=postgresql://<user>@127.0.0.1:5432/postgres pnpm live:smoke
```
Expected: таблиця з усіма `OK`, включно з чотирма новими рядками аватара.

- [ ] **Step 4: Перевірити, що прогін не насмітив у репо**

```bash
git status --porcelain
```
Expected: порожньо. 🔴 Якщо зʼявилась `.data/` — або `.gitignore` не підхопився (Task 2), або смок пише в корінь репо замість тимчасової теки: у другому випадку задай `MEDIA_ROOT` у env смоку явно, у тимчасову теку, і прибирай її по собі.

- [ ] **Step 5: Оновити `CLAUDE.md`**

Три точкові правки:
1. У Quick Reference до `pnpm live:smoke` дописати `+ аватар (порт сховища Е2)`.
2. У блоці «Environment Variables» — після трьох ключів контракту додати абзац про опційний `MEDIA_ROOT` із дефолтом і з приміткою, що контракт лишається трьома ключами (ключ закоментований, як `BETTER_AUTH_URL`).
3. У Project Structure у перелік тек пакета ядра додати рядок:

```
│   ├── src/storage/          # T2 🔴 Е2: порт сховища файлів — драйвер local-fs,
│   │                         #    іммутабельні ключі, MIME за байтами, запис
│   │                         #    файлу й рядка `media` однією транзакцією актора.
│   │                         #    server-only за contracts/server-only
```

4. У блоці статусу К3 замінити «storage-порт без драйверів (К4, мінімум — етап Е2)» на факт: порт і драйвер `local-fs` приземлені в Е2, живий споживач — аватар; `s3`, `transform` і sweep орфанів лишаються К4.

- [ ] **Step 6: Оновити роадмап**

У `docs/tasks/platform-roadmap.md` у списку етапів К3 замінити рядок `- [ ] **Е2** (storage-мінімум …)` на позначений виконаним із підсумком:

```markdown
     - [x] ✅ **Е2 — storage-мінімум.** Порт `simplycms/storage` (server-only):
           драйвер `local-fs` з іммутабельними ключами й атомарною публікацією,
           MIME за магічними байтами (SVG заборонений), `writeMedia`/`eraseMedia`
           — файл і рядок `media` однією транзакцією актора, роздача роутом
           `/media/$` з `nosniff` та `immutable`-кешем. У БД — **референс**, не
           URL (`resolveMediaUrl` у T1 + реєстр `MEDIA_COLUMNS` під гейтом).
           🔴 **Доведено живим прогоном:** аватар покупця — завантаження,
           роздача, заміна зі скасуванням старого обʼєкта, видалення.
           `ImageUpload` переведено на порт, але його пʼять сторінок лишаються
           на `supabase-js` до Е3–Е6 — DoD К3 п.6 закриває хвиля каталогу.
           План — [`2026-09-13-v2-k3-e2-storage-minimum.md`](../superpowers/plans/2026-09-13-v2-k3-e2-storage-minimum.md)
```

У пункті «К4 Storage» уточнити залишок: `s3`, `transform`/srcset, presigned direct-upload, облік невдалих видалень і sweep орфанів, привʼязка `entity_id` для медіатеки.

- [ ] **Step 7: Оновити карту стану**

У `docs/tasks/v2-state-map.md` §3.2 «Сховище файлів — порту немає» переписати під факт: порт є, аватар живий, зображення адмінки чекають на свої сторінки; `ReviewDetail` лишається на `supabase.storage` під ратчетом. У §5 «Як підняти локально» додати рядок про `MEDIA_ROOT` і про те, що `.data/media` створюється сама.

- [ ] **Step 8: Оновити межі тестування**

У `docs/architecture/test-contours.md`:
1. §11 (гейти К3) — додати рядки таблиці: `simplycms-storage/no-direct-storage` (+ фікстури), `storage-direct-calls` (ратчет файлового скану), `media-columns-coverage`, `media-record` (харнес), `storage/__tests__/serve` (юніти роздачі), із колонкою «Межа» — що саме кожен НЕ доводить. 🔴 Правило й ратчет — ДВА детектори з різними негативними контролями, як `server-only-relative` і групи межі плагінів у §12: рахувати їх одним рядком «лінт» було б неточно.
2. §12 (межа клієнт/сервер) — додати `storage` у перелік субшляхів `SERVER_ONLY` у вступному абзаці.
3. Дописати короткий підрозділ «Чого storage-контур не доводить»: орфани після обриву між `put` і COMMIT (К4), поведінка під конкурентним завантаженням того самого файлу двома адмінами (різні ключі — дублікат байтів, не помилка), і те, що `ImageUpload` не має живої сторінки в Е2.

- [ ] **Step 9: Повний ланцюг гейтів**

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm build
pnpm typecheck
pnpm test
pnpm test:schema
pnpm build:packages
pnpm typecheck:template
pnpm test:packaging
pnpm pilot:pack
```
Expected: усі зелені. 🔴 Зафіксувати в DoD-звіті: кількість warnings `pnpm lint` (не більша за замір Task 1) і таблицю `live:smoke`.

- [ ] **Step 10: Коміт**

```bash
git add scripts/live-smoke CLAUDE.md \
        docs/tasks/platform-roadmap.md docs/tasks/v2-state-map.md \
        docs/architecture/test-contours.md
git commit -m "docs(k3-e2): живий крок аватара в live:smoke, стан етапу в доках"
```

---

## DoD етапу Е2

1. **Живий прогін** (не тести): аватар покупця завантажується, роздається з `/media/<key>`, замінюється зі скасуванням старого обʼєкта й видаляється — усі вісім пунктів Task 5 Step 11 зелені.
2. `pnpm live:smoke` проходить із чотирма новими рядками аватара.
3. У `profiles.avatar_url` і `media.storage_key` лежить **референс**, у `<img src>` — URL: доведено прямим SQL у смоку.
4. `media.size_bytes` дорівнює фактичному розміру файлу на диску; падіння запису файлу відкочує рядок (харнес Task 3).
5. Видалення прибирає СПЕРШУ обʼєкт, ПОТІМ рядок; повтор після обриву проходить (харнес Task 3).
6. SVG відбивається і за байтами, і за розширенням `.png`; роздача ставить `nosniff`.
7. Traversal (сирий і процентно-кодований) дає 404 і не називає шляхів; драйвер відбиває ключ за межами кореня незалежно від роуту.
8. `storage` у `SERVER_ONLY`; сентинел у `dist-server-boundary` зелений; `pilot:pack` (Gate C + Gate IP) зелений.
9. Контракт env лишається **трьома** ключами; `MEDIA_ROOT` задокументований коментарем у `.env.example` і в шаблоні магазину; негативний контроль (активний ключ → червоний) прогнано.
10. Правило `simplycms-storage/no-direct-storage` і ратчет `storage-direct-calls` зелені, список виїмок — рівно один файл; обидва негативні контролі прогнано, включно з доказом, що нова зона НЕ замістила i18n-селектори.
11. Гейт `MEDIA_COLUMNS` зелений; негативний контроль (прибраний рядок реєстру → червоний) прогнано.
12. Повний ланцюг гейтів + `pilot:pack` зелений; warnings `pnpm lint` не зросли.
13. `git status --porcelain` після всіх прогонів порожній.
14. У доках названо вголос, чого етап НЕ доводить: DoD К3 п.6 (зображення товару) чекає на хвилю каталогу; орфани й sweep — К4.
