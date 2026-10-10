// Спільні правила банера (T1, Е6д-3): вітрина (`toBanner`) і ресурс адмінки
// кличуть ті самі предикати, щоб правило «яка кнопка валідна» не розійшлось.
// Масиви enum — у T0 `contracts/objects/banner.ts`.
import {
  BANNER_ANIMATIONS,
  BANNER_BUTTON_TARGETS,
  BANNER_BUTTON_VARIANTS,
  BANNER_PLACEMENTS,
  BANNER_TEXT_POSITIONS,
} from 'simplycms/contracts';
import type {
  BannerAnimation,
  BannerButton,
  BannerPlacement,
  BannerTextPosition,
} from 'simplycms/contracts';

export const BANNER_MAX_BUTTONS = 3;
export const BANNER_SLIDE_MS = { min: 1000, max: 15000 } as const;
export const BANNER_ANIMATION_MS = { min: 100, max: 2000 } as const;

/** `time` з Postgres повертається як `HH:MM:SS`, форма дає `HH:MM`. */
export const BANNER_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const BUTTON_TEXT_MAX = 50;
const BUTTON_URL_MAX = 500;
/** Лише `/шлях` (не `//host`) або `http(s)://`: `javascript:` у `href` — XSS (Е6д-13). */
const BUTTON_URL_RE = /^\/(?!\/)|^https?:\/\//;

function oneOf<T extends string>(values: readonly T[], v: unknown): v is T {
  return typeof v === 'string' && (values as readonly string[]).includes(v);
}

export const isBannerPlacement = (v: unknown): v is BannerPlacement =>
  oneOf(BANNER_PLACEMENTS, v);
export const isBannerTextPosition = (v: unknown): v is BannerTextPosition =>
  oneOf(BANNER_TEXT_POSITIONS, v);
export const isBannerAnimation = (v: unknown): v is BannerAnimation =>
  oneOf(BANNER_ANIMATIONS, v);

/** Строга перевірка кнопки: і значення enum, і безпечний `url`. */
export function isBannerButton(item: unknown): item is BannerButton {
  if (typeof item !== 'object' || item === null) return false;
  const obj = item as Record<string, unknown>;
  if (typeof obj.text !== 'string' || typeof obj.url !== 'string') return false;
  const text = obj.text.trim();
  return (
    text.length >= 1 &&
    text.length <= BUTTON_TEXT_MAX &&
    obj.url.length <= BUTTON_URL_MAX &&
    BUTTON_URL_RE.test(obj.url) &&
    oneOf(BANNER_BUTTON_TARGETS, obj.target) &&
    oneOf(BANNER_BUTTON_VARIANTS, obj.variant)
  );
}
