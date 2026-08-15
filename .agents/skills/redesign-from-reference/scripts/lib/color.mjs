/**
 * Колірна математика для design-import (Фаза 1, Р1/Р2 плану).
 *
 * Нуль зовнішніх залежностей (Р2): власний парсинг CSS-кольорів, конвертація
 * RGB↔HSL і WCAG-контраст. Приймаються ЛИШЕ формати, які реально повертає
 * `getComputedStyle` у Chromium — `#hex` (у розмітці фікстур) та `rgb()`/
 * `rgba()` (те, що бачить `inspect.mjs` у браузері). Сучасний CSS Color 4
 * синтаксис (пробіли замість ком) свідомо НЕ підтримується — інспекція
 * завжди йде через браузер, а не парсить чужий CSS-текст (YAGNI).
 */

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_RE =
  /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i;
/** Формат токена (`packages/theme-system/src/types.ts`): `"H S% L%"` без `hsl()`. */
const HSL_TRIPLE_RE = /^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/;

function expandHex(hex) {
  if (hex.length === 3 || hex.length === 4) {
    return hex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  return hex;
}

/** Розпарсити CSS-колір (`#hex`, `rgb()`, `rgba()`) → `{ r, g, b, a }` (0-255, a 0-1). */
export function parseColor(input) {
  if (typeof input !== 'string') return null;
  const value = input.trim();

  const hexMatch = HEX_RE.exec(value);
  if (hexMatch) {
    const hex = expandHex(hexMatch[1].toLowerCase());
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
    };
  }

  const rgbMatch = RGB_RE.exec(value);
  if (rgbMatch) {
    const [, r, g, b, a] = rgbMatch;
    return {
      r: Number(r),
      g: Number(g),
      b: Number(b),
      a: a === undefined ? 1 : Number(a),
    };
  }

  return null;
}

/** RGB (0-255) → HSL, округлено до цілих (конвенція `themes/default/tokens.ts`). */
export function rgbToHsl({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: Math.round(l * 100) };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;

  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** HSL → RGB (0-255, цілі) — зворотна конвертація для контраст-перевірки. */
export function hslToRgb({ h, s, l }) {
  const sn = s / 100;
  const ln = l / 100;

  if (sn === 0) {
    const gray = Math.round(ln * 255);
    return { r: gray, g: gray, b: gray };
  }

  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const hue2rgb = (t0) => {
    let t = t0;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const hn = h / 360;
  return {
    r: Math.round(hue2rgb(hn + 1 / 3) * 255),
    g: Math.round(hue2rgb(hn) * 255),
    b: Math.round(hue2rgb(hn - 1 / 3) * 255),
  };
}

/** Форматувати HSL у рядок-токен `"H S% L%"`. */
export function hslTriple({ h, s, l }) {
  return `${h} ${s}% ${l}%`;
}

/** Розпарсити рядок-токен `"H S% L%"` → `{ h, s, l }`, або `null`, якщо формат інший. */
export function parseHslTriple(value) {
  if (typeof value !== 'string') return null;
  const match = HSL_TRIPLE_RE.exec(value.trim());
  if (!match) return null;
  return { h: Number(match[1]), s: Number(match[2]), l: Number(match[3]) };
}

function channelLuminance(channel) {
  const cs = channel / 255;
  return cs <= 0.03928 ? cs / 12.92 : ((cs + 0.055) / 1.055) ** 2.4;
}

/** Відносна яскравість за формулою WCAG 2.x (для контраст-відношення). */
export function relativeLuminance({ r, g, b }) {
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

/** Контраст-відношення WCAG (1..21) між двома RGB-кольорами. */
export function contrastRatio(rgbA, rgbB) {
  const lA = relativeLuminance(rgbA);
  const lB = relativeLuminance(rgbB);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}
