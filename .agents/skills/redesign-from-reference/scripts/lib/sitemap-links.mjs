/**
 * Запис ВХОДУ класифікатора для `sitemap-proposal.json` (інкремент Б.3, Р4/V-3).
 * Окремий модуль, бо `lib/sitemap.mjs` після типізованого блокування пар
 * (`visit-mismatch`) не має вільних рядків під канон ≤150.
 */
import { normalizePathname } from './classify.mjs';

/**
 * Дедуплікований за нормалізованим pathname зріз лінків з агрегованими
 * якорями. 🔴 Будується з ВХІДНОГО набору — до будь-яких виключень
 * перепідбору: це протокол того, що інструмент побачив, а не знімок робочого
 * стану. Порядок — лексикографічний за pathname.
 * @param {Array<{ url: string, anchors?: string[] }>} links
 * @returns {Array<{ pathname: string, anchors: string[] }>}
 */
export function summarizeLinks(links) {
  const byPathname = new Map();
  for (const link of links) {
    const pathname = normalizePathname(link.url);
    const texts = (link.anchors ?? []).map((a) => a.trim()).filter(Boolean);
    const existing = byPathname.get(pathname);
    if (existing) texts.forEach((t) => existing.add(t));
    else byPathname.set(pathname, new Set(texts));
  }
  return [...byPathname]
    .map(([pathname, anchors]) => ({ pathname, anchors: [...anchors] }))
    .sort((a, b) => a.pathname.localeCompare(b.pathname));
}
