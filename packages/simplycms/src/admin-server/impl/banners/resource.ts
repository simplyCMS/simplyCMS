import type { z } from 'zod';
import { z as zod } from 'zod';
import { banners } from 'simplycms/schema';
import { ENTITY } from 'simplycms/contracts/entities';
import {
  BANNER_ANIMATIONS,
  BANNER_PLACEMENTS,
  BANNER_TEXT_POSITIONS,
} from 'simplycms/contracts';
import type { BannerButton } from 'simplycms/contracts';
import {
  BANNER_ANIMATION_MS,
  BANNER_MAX_BUTTONS,
  BANNER_SLIDE_MS,
  BANNER_TIME_RE,
  isBannerButton,
  isSafeCssColor,
} from 'simplycms/domain';
import { defineAdminResource } from '../resource';
import { guardBanners } from './guard';

/** Текст і url кнопки тримаються без відступів: предикат бачить те, що збережеться. */
const trimButton = (b: unknown): unknown =>
  typeof b === 'object' &&
  b !== null &&
  typeof (b as { text?: unknown }).text === 'string' &&
  typeof (b as { url?: unknown }).url === 'string'
    ? {
        ...b,
        text: (b as BannerButton).text.trim(),
        url: (b as BannerButton).url.trim(),
      }
    : b;

const scheduleDays = () =>
  zod
    .array(zod.number().int().min(0).max(6))
    .max(7)
    .refine((d) => new Set(d).size === d.length)
    // Порожній розклад = «щодня» = null, як у легасі.
    .transform((d) => (d.length > 0 ? d : null));

/**
 * Банери (Е6д, Task 3). Правила `refine` — з T0/T1 (`contracts`, `domain`),
 * перехресні — `guardBanners`. `media`: заміна/видалення картинки стирає її
 * файл після COMMIT (Е6д-1/14).
 */
export const bannersOps = defineAdminResource({
  entity: ENTITY.banners,
  table: banners,
  operation: 'banner.manage',
  mode: 'eager',
  filterable: ['placement', 'isActive', 'sectionId'],
  sortable: ['sortOrder'],
  defaultOrder: { column: 'sortOrder', direction: 'asc' },
  touch: 'updatedAt',
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
  refine: {
    title: (s: z.ZodString) => s.trim().min(1).max(200),
    subtitle: (s: z.ZodString) => s.max(500),
    imageUrl: (s: z.ZodString) => s.min(1),
    placement: () => zod.enum(BANNER_PLACEMENTS),
    textPosition: () => zod.enum(BANNER_TEXT_POSITIONS),
    animationType: () => zod.enum(BANNER_ANIMATIONS),
    buttons: () =>
      zod
        .array(zod.custom<BannerButton>((b) => isBannerButton(trimButton(b))))
        .max(BANNER_MAX_BUTTONS)
        .transform((a) => a.map((b) => trimButton(b) as BannerButton)),
    scheduleDays,
    scheduleTimeFrom: (s: z.ZodString) => s.regex(BANNER_TIME_RE),
    scheduleTimeTo: (s: z.ZodString) => s.regex(BANNER_TIME_RE),
    slideDuration: (s: z.ZodNumber) =>
      s.min(BANNER_SLIDE_MS.min).max(BANNER_SLIDE_MS.max),
    animationDuration: (s: z.ZodNumber) =>
      s.min(BANNER_ANIMATION_MS.min).max(BANNER_ANIMATION_MS.max),
    overlayColor: (s: z.ZodString) => s.refine((v) => isSafeCssColor(v)),
  },
  media: {
    entityType: 'banner',
    columns: ['imageUrl', 'desktopImageUrl', 'mobileImageUrl'],
  },
  guard: guardBanners,
});
