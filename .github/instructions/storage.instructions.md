---
applyTo: "packages/simplycms/core/**/*.{ts,tsx},app/**/*.{ts,tsx}"
description: "Правила роботи з файловим сховищем Supabase Storage в SimplyCMS"
---

# Storage Rules

## Архітектура

SimplyCMS використовує **Supabase Storage** для зберігання файлів:
- Зображення товарів
- Банери
- Аватари користувачів
- Файли відгуків

## ✅ ALWAYS

### Upload
- Використовуй Supabase Storage API через `@simplysoftua/core` обгортки.
- Валідуй файли перед upload (розмір, MIME type).
- Використовуй `next/image` для оптимізації зображень на storefront.
- Генеруй унікальні імена файлів для уникнення конфліктів.

### Storage Paths
- Формат: `{section}/{entity_id}/{filename}`
- Секції: `products`, `banners`, `avatars`, `reviews`
- Приклад: `products/123/main-image.jpg`

### Зображення
- Storefront: `next/image` з `remotePatterns` для `*.supabase.co`.
- Admin: `ImageUpload` компонент з `@simplysoftua/admin`.
- Публічні бакети для зображень товарів та банерів.

### Конфігурація
- Remote patterns налаштовані в `next.config.ts`:
  ```typescript
  images: {
    remotePatterns: [{
      protocol: 'https',
      hostname: '*.supabase.co',
      pathname: '/storage/v1/object/public/**',
    }],
  },
  ```

## ❌ NEVER
- Не викликай `supabase.storage.from()` напряму в компонентах — використовуй обгортки.
- Не хардкодь Storage URL — використовуй змінні оточення.
- Не завантажуй файли без валідації (розмір, тип).
- Не використовуй signed URLs для публічних зображень — використовуй public URLs.

## ℹ️ Де шукати деталі
- `packages/simplycms/admin/src/components/ImageUpload.tsx` — компонент upload.
- `next.config.ts` — конфігурація remote patterns для зображень.
- `temp/src/components/admin/ImageUpload.tsx` — референсна реалізація (read-only).
