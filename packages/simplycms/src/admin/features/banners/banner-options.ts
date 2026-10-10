import type { MessageKey } from 'simplycms/i18n';
import {
  BANNER_ANIMATIONS,
  BANNER_BUTTON_TARGETS,
  BANNER_BUTTON_VARIANTS,
  BANNER_PLACEMENTS,
  BANNER_TEXT_POSITIONS,
} from 'simplycms/contracts';

/**
 * Підписи значень enum T0 — мапи КЛЮЧІВ (`Record` за union змушує типом
 * охопити кожне значення: нове значення без підпису не скомпілюється).
 */
export const PLACEMENT_KEYS: Record<
  (typeof BANNER_PLACEMENTS)[number],
  MessageKey
> = {
  home: 'admin.banners.placement.home',
  catalog: 'admin.banners.placement.catalog',
  section: 'admin.banners.specificSection',
  blog: 'admin.banners.placement.blog',
  global: 'admin.banners.placement.global',
};

/** Підпис розміщення для списку (там «Розділ», а не «Конкретний розділ»). */
export const PLACEMENT_LIST_KEYS: Record<
  (typeof BANNER_PLACEMENTS)[number],
  MessageKey
> = { ...PLACEMENT_KEYS, section: 'admin.banners.placement.section' };

export const ALIGN_KEYS: Record<
  (typeof BANNER_TEXT_POSITIONS)[number],
  MessageKey
> = {
  left: 'admin.banners.align.left',
  center: 'admin.banners.align.center',
  right: 'admin.banners.align.right',
};

export const ANIMATION_KEYS: Record<
  (typeof BANNER_ANIMATIONS)[number],
  MessageKey
> = {
  slide: 'admin.banners.anim.slide',
  fade: 'admin.banners.anim.fade',
  zoom: 'admin.banners.anim.zoom',
  none: 'admin.banners.anim.none',
};

export const TARGET_KEYS: Record<
  (typeof BANNER_BUTTON_TARGETS)[number],
  MessageKey
> = {
  _self: 'admin.banners.targetSelf',
  _blank: 'admin.banners.targetBlank',
};

export const VARIANTS = BANNER_BUTTON_VARIANTS;

/** `0` = неділя, як у `isBannerVisible`; порядок показу — пн…нд. */
export const WEEKDAYS: readonly { value: number; key: MessageKey }[] = [
  { value: 1, key: 'admin.banners.weekday.mon' },
  { value: 2, key: 'admin.banners.weekday.tue' },
  { value: 3, key: 'admin.banners.weekday.wed' },
  { value: 4, key: 'admin.banners.weekday.thu' },
  { value: 5, key: 'admin.banners.weekday.fri' },
  { value: 6, key: 'admin.banners.weekday.sat' },
  { value: 0, key: 'admin.banners.weekday.sun' },
];

export const opts = (
  values: readonly string[],
  keys: Readonly<Record<string, MessageKey>>,
  t: (k: MessageKey) => string,
) => values.map((value) => ({ value, text: t(keys[value]!) }));
