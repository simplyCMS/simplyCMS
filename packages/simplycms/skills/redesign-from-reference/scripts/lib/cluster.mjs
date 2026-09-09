/**
 * Кластеризація колірних семплів за HSL-близькістю (Фаза 1, Р7 плану).
 *
 * Вхідні семпли — `{ value, frequency, area?, interactive? }`, де `value` —
 * сирий CSS-колір (`#hex`/`rgb()`/`rgba()`, `lib/color.mjs`). Алгоритм
 * жадібний (перший підхожий кластер за порядком вхідного масиву) — детермінізм
 * тримається на тому, що вхідний масив сам детермінований (фікстура або
 * `inspection.json`, зафіксовані на диску), а не на порядково-незалежній
 * кластеризації.
 */
import { parseColor, rgbToHsl } from './color.mjs';

/**
 * Поріг кластеризації: сума трьох рівновагових відстаней — circular hue
 * (0-180), saturation (0-100), lightness (0-100). 15 — емпіричний баланс:
 * менше — близькі відтінки того самого елемента (напр. hover/active стан
 * кнопки, антиаліасинг країв) лишаються окремими кластерами і засмічують
 * `unmapped`; більше — різні поверхні (фон і картка) чи різні бренд-кольори
 * (синій CTA і фіолетовий акцент) злипаються в один кластер і мапінг втрачає
 * сигнал. Ахроматичні кольори (`s < 10%` — сірий/білий/чорний) кластеризуються
 * ЛИШЕ за lightness: hue для них не визначено (без цього винятку білий і
 * чорний з дрейфом hue не зливались би з власними відтінками взагалі).
 */
export const CLUSTER_THRESHOLD = 15;
const GRAYSCALE_SATURATION = 10;

function circularHueDistance(h1, h2) {
  const diff = Math.abs(h1 - h2) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function hslDistance(a, b) {
  const bothGray = a.s < GRAYSCALE_SATURATION && b.s < GRAYSCALE_SATURATION;
  const hueDiff = bothGray ? 0 : circularHueDistance(a.h, b.h);
  return hueDiff + Math.abs(a.s - b.s) + Math.abs(a.l - b.l);
}

/**
 * Згрупувати колір-семпли, що потрапляють у той самий HSL-кластер.
 *
 * Кожен кластер несе `value`/`hsl` семпла з НАЙБІЛЬШОЮ частотою всередині
 * себе (canonical pick — не усереднення, щоб значення лишалось реальним
 * кольором зі сторінки), сумарну `frequency`/`area` і `interactive`, якщо
 * хоч один злитий семпл був інтерактивним. Вивід відсортований за спаданням
 * частоти, tie-break — зростання hue (Р7: стабільність незалежно від
 * порядку елементів з однаковою частотою).
 */
export function clusterColors(samples, threshold = CLUSTER_THRESHOLD) {
  const parsed = samples
    .map((sample) => {
      const rgb = parseColor(sample.value);
      return rgb ? { ...sample, hsl: rgbToHsl(rgb) } : null;
    })
    .filter((sample) => sample !== null);

  const clusters = [];

  for (const sample of parsed) {
    const match = clusters.find(
      (c) => hslDistance(c.hsl, sample.hsl) <= threshold,
    );
    if (!match) {
      clusters.push({
        value: sample.value,
        hsl: sample.hsl,
        frequency: sample.frequency,
        area: sample.area ?? 0,
        interactive: Boolean(sample.interactive),
        topFrequency: sample.frequency,
      });
      continue;
    }

    match.frequency += sample.frequency;
    match.area += sample.area ?? 0;
    match.interactive = match.interactive || Boolean(sample.interactive);
    if (sample.frequency > match.topFrequency) {
      match.topFrequency = sample.frequency;
      match.value = sample.value;
      match.hsl = sample.hsl;
    }
  }

  // `topFrequency` — службове поле для вибору canonical-семпла (див. вище),
  // назовні не віддаємо.
  return clusters
    .map((c) => ({
      value: c.value,
      hsl: c.hsl,
      frequency: c.frequency,
      area: c.area,
      interactive: c.interactive,
    }))
    .sort((a, b) => b.frequency - a.frequency || a.hsl.h - b.hsl.h);
}
