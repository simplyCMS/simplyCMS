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
  `tests/media-columns-coverage.test.ts`.
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
