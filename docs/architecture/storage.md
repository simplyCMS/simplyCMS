# Сховище файлів

Файли живуть за портом **`simplycms/storage`** — server-only піддерево (за
декларацією `contracts/server-only`). Драйвер за замовчуванням — `local-fs` (диск,
корінь із `MEDIA_ROOT`, дефолт `./.data/media` відносно робочої теки процесу;
у проді — змонтований том, бо дефолт лежить усередині теки деплою). Другий драйвер
(`s3`) реалізує той самий інтерфейс `MediaStorageDriver` пізніше (трек К4).

**У БД лежить РЕФЕРЕНС, не URL.** Референс — storage key (`ab/<uuid>.<ext>`) для
завантаженого файлу; зовнішні `https?:`, вбудовані `data:` і корене-відносні `/…`
проходять як є. Резолв у URL — одна чиста функція `resolveMediaUrl`
(`simplycms/domain/media`, T1, клієнтобезпечна); роздача — `/media/*`
(`packages/simplycms/routes/storefront/media/$.tsx`).

## Правила

- Завантаження й видалення — **лише serverFn**: `uploadMedia`/`deleteMedia`
  (`simplycms/admin-server`) для адмінки, `uploadMyAvatar`/`removeMyAvatar`
  (`simplycms/core/lib/profile-avatar`) для кабінету.
- Рядок `media` і файл пишуться **однією транзакцією актора** — `writeMedia(db, …)`.
  Видалення — `eraseMedia(db, ref)`, і порядок там зворотний: СПЕРШУ `DELETE`
  рядка, ПОТІМ обʼєкт, обидва до `COMMIT`. Необоротна дія стоїть якомога пізніше:
  за зворотним порядком відмова БД після `driver.delete` знищила б файл
  безповоротно.
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
  ратчет `tests/storage-direct-calls.test.ts` це валять. Єдина виїмка —
  `admin/pages/ReviewDetail.tsx` (мертва легасі-сторінка, список лише скорочується).
- Не клади URL у колонку сутності — лише референс.
- Не читай `MEDIA_ROOT` на модуль-рівні — лише в рантаймі, всередині функції
  (контракт серверного env).
- `<img>` на вітрині: `loading="lazy"` і явні `width`/`height` або `aspect-ratio`.

Живий доказ порту — `pnpm live:smoke` (аватар: завантаження, роздача `/media`,
референс у БД, видалення). Код — `packages/simplycms/src/storage/`; драйвер, запис і
роздача — окремі модулі (`local-fs.ts`, `record.ts`, `serve.ts`).
