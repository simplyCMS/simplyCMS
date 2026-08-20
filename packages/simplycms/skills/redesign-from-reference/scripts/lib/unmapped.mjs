/**
 * Структурований звіт про кольори, які нікуди не лягли (план Р7; знахідки
 * V-6 + V-7 прогону №2). Окремий модуль, а не доважок до `color-tokens.mjs` —
 * той уже впритул до канону 150 рядків, і предмет тут інший: не мапінг, а
 * ЧЕСНІСТЬ виводу. До Б.3 `unmapped` був голим списком hex із дублікатами:
 * ні ролі, ні частоти, ні контрасту — тож провальний за AA текстовий колір
 * (`#6a7282` на полотні, 4.44) дві сесії поспіль проходив повз попередження,
 * бо `contrastWarnings` дивиться ЛИШЕ на змаповані пари.
 */
import {
  contrastRatio,
  hslToRgb,
  parseColor,
  parseHslTriple,
  rgbToHex,
} from './color.mjs';
import { AA_MIN_RATIO } from './contrast.mjs';

/**
 * @typedef {{ value: string, hsl: { h: number, s: number, l: number },
 *   frequency: number, area?: number }} ColorCluster
 * @typedef {{ hex: string, role: string, count: number, area: number,
 *   contrastOnBackground: number | null, contrastOnCard: number | null,
 *   belowAA: boolean }} UnmappedEntry
 */

/**
 * Контраст кольору проти токена-поверхні (`"H S% L%"`), округлений до сотих.
 * `null` — токена в пропозиції немає (а НЕ `0`: нуль читався б як виміряний
 * і катастрофічний контраст, якого ніхто не міряв).
 */
function contrastAgainst(rgb, tokenValue) {
  const hsl = parseHslTriple(tokenValue);
  if (!hsl) return null;
  return Math.round(contrastRatio(rgb, hslToRgb(hsl)) * 100) / 100;
}

/**
 * Зібрати `unmapped` із кластерів, що не потрапили в жоден токен.
 * @param {Record<string, ColorCluster[]>} byRole кластери за роллю семпла
 * @param {Set<object>} used кластери, вже витрачені мапінгом (посилання, не значення)
 * @param {Record<string, string>} tokens запропоновані токени — потрібні `background`/`card`
 * @returns {UnmappedEntry[]}
 */
export function collectUnmapped(byRole, used, tokens) {
  const entries = new Map();

  for (const [role, clusters] of Object.entries(byRole)) {
    for (const cluster of clusters) {
      if (used.has(cluster)) continue;
      const rgb = parseColor(cluster.value) ?? hslToRgb(cluster.hsl);
      const hex = rgbToHex(rgb);
      // 🔴 Ключ дедупу — hex + РОЛЬ. Той самий колір як текст і як фон секції —
      // це два різні факти про сторінку (саме тому `used` у `color-tokens.mjs`
      // тримає посилання на кластери, а не значення), і злиття їх приховало б
      // роль, від якої залежить `belowAA`. Дублі ж усередині однієї ролі
      // (`rgb(17,17,17)` і `#111111` — різні рядки, один колір) схлопуються.
      const key = `${hex}|${role}`;
      const known = entries.get(key);
      if (known) {
        known.count += cluster.frequency;
        known.area += cluster.area ?? 0;
        continue;
      }

      const onBackground = contrastAgainst(rgb, tokens.background);
      const onCard = contrastAgainst(rgb, tokens.card);
      const measured = [onBackground, onCard].filter((r) => r !== null);
      entries.set(key, {
        hex,
        role,
        count: cluster.frequency,
        area: cluster.area ?? 0,
        contrastOnBackground: onBackground,
        contrastOnCard: onCard,
        // 🔴 Прапорець має сенс ЛИШЕ для ролі `text`: контраст фонового
        // кольору «на фоні» ≈1 за визначенням, і на решті ролей прапорець
        // засвітив би геть усе, тобто не означав би нічого. Беремо НАЙГІРШУ
        // з доступних поверхонь: провал на картці так само тихий, як провал
        // на полотні (V-7), а поверхонь у пропозиції дві.
        belowAA:
          role === 'text' &&
          measured.length > 0 &&
          Math.min(...measured) < AA_MIN_RATIO,
      });
    }
  }

  // Стабільний порядок (Р7): частота ↓, далі hex, далі роль — щоб два прогони
  // на тому самому `inspection.json` давали побайтово однаковий файл.
  return [...entries.values()].sort(
    (a, b) =>
      b.count - a.count ||
      a.hex.localeCompare(b.hex) ||
      a.role.localeCompare(b.role),
  );
}
