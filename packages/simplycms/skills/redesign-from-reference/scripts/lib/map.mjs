/**
 * Евристики мапінгу `inspection.json` → `tokens-proposal.json` (задача
 * §2.B.1, план Р4/Р7). Чиста детерміністична логіка: без IO — його робить
 * тонкий CLI `map-tokens.mjs` (Фаза 3). Колірна частина — `color-tokens.mjs`,
 * шрифтова — `fonts.mjs`; тут лише радіус і збірка фінальної форми.
 */
import { mapColorTokens } from './color-tokens.mjs';
import { checkContrastPairs } from './contrast.mjs';
import { mapFonts } from './fonts.mjs';

// 2 (інкремент Б.3, Р7) — `unmapped` став масивом записів
// `{ hex, role, count, area, contrastOnBackground, contrastOnCard, belowAA }`
// замість масиву рядків: форма ЛАМАЄТЬСЯ, тож бамп чесний. 🔴 Лічильників
// версій у інструменті ТРИ, і цей — не той, що в `lib/inspect-page.mjs`
// (`inspection.json`, вхід — уже 3) і не той, що в `lib/sitemap.mjs`
// (`sitemap-proposal.json`). Рухаються незалежно.
const SCHEMA_VERSION = 2;

/** Радіус-кластер із найбільшою частотою → `rem` (16px root, конвенція теми). */
function pickRadius(radiusEntries) {
  if (!Array.isArray(radiusEntries) || radiusEntries.length === 0) return null;
  const top = [...radiusEntries].sort(
    (a, b) => b.frequency - a.frequency || a.valuePx - b.valuePx,
  )[0];
  return `${(top.valuePx / 16).toFixed(3).replace(/\.?0+$/, '')}rem`;
}

/**
 * Мапити `inspection.json`-подібний обʼєкт (Р4) → `tokens-proposal.json`
 * (`{ schemaVersion, tokens, fonts?, confidence, contrastWarnings, unmapped }`).
 * @returns {{
 *   schemaVersion: 2,
 *   tokens: Record<string, string> & { dark?: Record<string, string> },
 *   fonts?: Array<{ stylesheet: string }>,
 *   confidence: Record<string, number>,
 *   contrastWarnings: Array<{ pair: string, ratio: number, required: number }>,
 *   unmapped: import('./unmapped.mjs').UnmappedEntry[],
 * }}
 */
export function mapTokens(inspection) {
  const light = mapColorTokens(inspection.colors ?? []);
  const tokens = { ...light.tokens };

  const radius = pickRadius(inspection.radius);
  if (radius) tokens.radius = radius;

  const fontResult = mapFonts(inspection);
  Object.assign(tokens, fontResult.tokens);

  // `dark` — усередині `tokens` (форма `DesignTokens` 1:1, Р4). Власний `unmapped`/
  // `confidence` темного набору не виводимо — dark лишається діагностованим через
  // ті самі `contrastWarnings` нижче (з префіксом `dark:`).
  if (inspection.darkDetected && inspection.dark?.colors) {
    const dark = mapColorTokens(inspection.dark.colors).tokens;
    if (Object.keys(dark).length > 0) tokens.dark = dark;
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    tokens,
    ...(fontResult.fonts ? { fonts: fontResult.fonts } : {}),
    confidence: light.confidence,
    contrastWarnings: [
      ...checkContrastPairs(tokens),
      ...(tokens.dark ? checkContrastPairs(tokens.dark, 'dark:') : []),
    ],
    unmapped: light.unmapped,
  };
}
