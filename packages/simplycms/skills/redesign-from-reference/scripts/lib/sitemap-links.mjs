/**
 * Запис ВХОДУ класифікатора для `sitemap-proposal.json` (інкремент Б.3, Р4/V-3).
 * Окремий модуль, бо `lib/sitemap.mjs` після типізованого блокування пар
 * (`visit-mismatch`) не має вільних рядків під канон ≤150.
 */
import { groupLinksByPathname } from './classify.mjs';

/**
 * Дедуплікований за нормалізованим pathname зріз лінків з агрегованими
 * якорями. 🔴 Групування — ТА САМА `groupLinksByPathname`, що й у
 * класифікаторі (разом зі стартовим pathname): друга реалізація мовчки
 * розійшлася б із першою, і поле `links` перестало б бути тим, що бачив
 * класифікатор. 🔴 Будується з ВХІДНОГО набору — до будь-яких виключень
 * перепідбору: це протокол того, що інструмент побачив, а не знімок робочого
 * стану. Порядок — лексикографічний за pathname.
 * @param {Array<{ url: string, anchors?: string[] }>} links
 * @param {string} startUrl стартовий URL прогону — теж запис входу
 * @returns {Array<{ pathname: string, anchors: string[] }>}
 */
export function summarizeLinks(links, startUrl) {
  return [...groupLinksByPathname(links, startUrl)]
    .map(([pathname, { anchors }]) => ({ pathname, anchors: [...anchors] }))
    .sort((a, b) => a.pathname.localeCompare(b.pathname));
}
