// Фікстури харнесу опції `media` фабрики ресурсів (К3-Е6д, Task 2, Е6д-1/14).
// Ресурс над `banners` — ВЛАСНИЙ, тестовий: фабрика перевіряється як механізм,
// незалежно від справжнього ресурсу банерів (Task 3). `MEDIA_ROOT` ставиться ДО
// першого `getMediaDriver()`: драйвер мемоізований (`storage/local-fs.ts`).
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll } from 'vitest';
import { z } from 'zod';
import { withActor } from 'simplycms/db';
import { isBannerButton } from 'simplycms/domain';
import { banners } from 'simplycms/schema';
import { writeMedia } from 'simplycms/storage';
import { defineAdminResource } from '../../../../src/admin-server/impl/resource';
import { rows, useShippingAdminDb } from './admin-shipping';

export const bannerMediaOps = defineAdminResource({
  entity: 'banners',
  table: banners,
  operation: 'banner.manage',
  mode: 'eager',
  filterable: [],
  sortable: [],
  writable: [
    'title',
    'subtitle',
    'imageUrl',
    'sortOrder',
    'isActive',
    'placement',
    'sectionId',
    'buttons',
    'dateFrom',
    'dateTo',
    'scheduleDays',
    'scheduleTimeFrom',
    'scheduleTimeTo',
    'slideDuration',
    'animationType',
    'animationDuration',
    'overlayColor',
    'textPosition',
    'desktopImageUrl',
    'mobileImageUrl',
  ],
  readonly: ['id', 'createdAt', 'updatedAt'],
  touch: 'updatedAt',
  // jsonb без `.$type<>()` — мінімальний refine; повний робить ресурс Task 3.
  refine: {
    buttons: () => z.array(z.unknown()).refine((a) => a.every(isBannerButton)),
  },
  media: {
    entityType: 'banner',
    columns: ['imageUrl', 'desktopImageUrl', 'mobileImageUrl'],
  },
});

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
export const DATA_REF = 'data:image/svg+xml,%3Csvg%2F%3E';

/** Тимчасовий `MEDIA_ROOT` (поза хуком — лінт `react-hooks/immutability`). */
function mountMediaRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'simplycms-e6d-media-'));
  process.env.MEDIA_ROOT = root;
  return root;
}
function unmountMediaRoot(root: string): void {
  rmSync(root, { recursive: true, force: true });
  delete process.env.MEDIA_ROOT;
}

export function useBannerMediaDb(prefix: string) {
  const state = { root: '' };
  // Корінь монтується ДО бази: хук `beforeAll` фікстури БД іде слідом.
  beforeAll(() => {
    state.root = mountMediaRoot();
  });
  afterAll(() => unmountMediaRoot(state.root));
  const db = useShippingAdminDb(prefix);
  const q = (text: string, p: unknown[] = []) => rows(db.url(), text, p);

  /** Файл і рядок `media` сутності — як їх пише адмінський `uploadMedia`. */
  const upload = async (entityId: string, entityType = 'banner') =>
    (
      await withActor({ role: 'app_admin' }, (tx) =>
        writeMedia(tx, {
          bytes: PNG,
          mime: 'image/png',
          entityType,
          entityId,
          uploadedBy: null,
        }),
      )
    ).ref;

  return {
    q,
    upload,
    hasFile: (ref: string) => existsSync(join(state.root, ref)),
    mediaCount: async (ref: string) =>
      (
        await q(
          `select count(*)::int n from public.media where storage_key = $1`,
          [ref],
        )
      )[0]!.n as number,
    banner: async (id: string) =>
      (
        await q(
          `select title, image_url, desktop_image_url, mobile_image_url
             from public.banners where id = $1`,
          [id],
        )
      )[0],
  };
}
