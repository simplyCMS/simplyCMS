import type { EntityName } from 'simplycms/contracts/entities';

/**
 * Реєстр легасі-адмінки на `useSupabaseClient` (трек К3). Дзеркалить
 * ФАКТИЧНИЙ скан `rg -l useSupabaseClient packages/simplycms/src/admin`:
 * файл зʼявляється тут, поки лишається легасі, і ЗНИКАЄ, коли сторінку
 * переписано на server-first (`admin-server` + `admin-data`). Двосторонню
 * звірку з диском тримає `tests/admin-server-first-registry.test.ts`.
 */
export type LegacyWave = 'Е5' | 'Е6' | 'Е7';

/**
 * Свідомі винятки К3-2: файл лишається на supabase-js, бо це не CRUD
 * сутності, а обчислення. Кожен виняток називає сутності, операції й причину.
 */
export const SERVER_FIRST_EXCEPTIONS: ReadonlyArray<{
  file: string;
  entities: readonly EntityName[];
  operations: readonly string[];
  reason: string;
  wave: LegacyWave;
}> = [];

/** Решта легасі-файлів адмінки: хвиля, у якій їх переписують. */
export const PENDING_LEGACY: ReadonlyArray<{ file: string; wave: LegacyWave }> =
  [
    {
      file: 'packages/simplycms/src/admin/layouts/LegacySupabaseBoundary.tsx',
      wave: 'Е7',
    },
    {
      file: 'packages/simplycms/src/admin/layouts/__tests__/LegacySupabaseBoundary.test.tsx',
      wave: 'Е7',
    },
    { file: 'packages/simplycms/src/admin/pages/BannerEdit.tsx', wave: 'Е6' },
    { file: 'packages/simplycms/src/admin/pages/Banners.tsx', wave: 'Е6' },
    { file: 'packages/simplycms/src/admin/pages/ReviewDetail.tsx', wave: 'Е6' },
    { file: 'packages/simplycms/src/admin/pages/Reviews.tsx', wave: 'Е6' },
    { file: 'packages/simplycms/src/admin/pages/UserEdit.tsx', wave: 'Е6' },
    { file: 'packages/simplycms/src/admin/pages/Users.tsx', wave: 'Е6' },
  ];
