/**
 * Побудова `sitemap-proposal.json` з уже зібраних лінків (задача §2.C.3-4,
 * план Р4/Р5). Чиста оркестрація — `classifyLinks` (Фаза 2, не переписуємо)
 * дає найкращого кандидата на тип; `visit` — інжектована async-функція
 * `(url, type) => Promise<{ok, title?, probe?}>` (у CLI — `page.goto` плюс
 * `browserVisitProbe`, у юніт-тестах — фейк), тож і перепідбір, і
 * контент-верифікація тестуються без браузера.
 *
 * 🔴 Провалів візиту два роди, і шлях у них ОДИН: `visit-failed` (не-2xx або
 * мережева помилка) і `visit-mismatch` (сторінка відкрилась, але її зміст
 * суперечить типу — `detectVisitMismatch`, інкремент Б.3/Р5). В обох випадках
 * кандидат відхиляється й спрацьовує той самий перепідбір; різниця лише в
 * причині, яку бачить читач пропозиції.
 *
 * 🔴 Кандидат, чий візит НЕ ok, НЕ лишається «знайденим»: його pathname
 * виключається з робочого набору лінків і `classifyLinks` перераховується —
 * тип отримує наступного за score кандидата, якщо він є (Р4). Цикл
 * завершується, коли черговий прохід нікого не виключив (стабілізація) —
 * лічильник виключень на ітерацію гарантує термінацію (лінків скінченна
 * кількість). Бюджет візитів (`maxVisits`) — спільний на ВСІ типи; кандидат
 * понад бюджет лишається знайденим, але чесно `visited: false`.
 *
 * 🔴 `schemaVersion: 2` (інкремент Б.3, Р4/V-3): голе число `linksSeen`
 * ЗАМІНЕНО масивом `links` — саме те, що бачив класифікатор. Без нього
 * діагностика помилки класифікації вимагала власного зонда: з пропозиції не
 * було видно ні які pathname зібрано, ні з якими якорями.
 */
import { classifyLinks, normalizePathname } from './classify.mjs';
import { URL_PATTERNS } from './classify-terms.mjs';
import { detectVisitMismatch } from './visit-probe.mjs';

/** Усі канонічні типи сторінок — `home` (окреме правило в `classifyLinks`) + словник Фази 2. */
const ALL_TYPES = ['home', ...Object.keys(URL_PATTERNS)];

/**
 * Запис ВХОДУ класифікатора (V-3): дедуплікований за нормалізованим pathname
 * зріз лінків з агрегованими якорями. 🔴 Будується з вхідного набору — ДО
 * будь-яких виключень перепідбору: це протокол того, що інструмент побачив,
 * а не знімок робочого стану. Порядок — лексикографічний за pathname.
 * @param {Array<{ url: string, anchors?: string[] }>} links
 * @returns {Array<{ pathname: string, anchors: string[] }>}
 */
function summarizeLinks(links) {
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

/**
 * @param {{
 *   links: Array<{ url: string, anchors: string[] }>,
 *   startUrl: string,
 *   maxVisits: number,
 *   visit: (url: string, type: string) => Promise<{
 *     ok: boolean, title?: string | null,
 *     probe?: { jsonLdTypes: string[], cardLinks: number },
 *   }>,
 * }} params
 * @returns {Promise<{
 *   schemaVersion: 2, startUrl: string,
 *   links: Array<{ pathname: string, anchors: string[] }>,
 *   pageTypes: Record<string, { url: string, score: number, evidence: unknown[], visited: boolean, title?: string }>,
 *   unresolved: Array<{ type: string, reason: 'no-candidate' | 'visit-failed' | 'visit-mismatch' }>,
 * }>}
 */
export async function buildSitemapProposal({
  links,
  startUrl,
  maxVisits,
  visit,
}) {
  let workingLinks = links;
  const finalPageTypes = {};
  // 🔴 Не Set, а Map: причина відмови — частина відповіді. Якщо тип провалив
  // кілька кандидатів поспіль, лишається причина ОСТАННЬОГО — саме він і є
  // тим, на чому перепідбір зупинився.
  const failedTypes = new Map();
  let visitsUsed = 0;

  for (;;) {
    const { pageTypes } = classifyLinks(workingLinks, startUrl);
    const pending = Object.keys(pageTypes).filter(
      (type) => !finalPageTypes[type],
    );
    if (pending.length === 0) break;

    let excludedAny = false;
    for (const type of pending) {
      const candidate = pageTypes[type];
      if (visitsUsed >= maxVisits) {
        finalPageTypes[type] = { ...candidate, visited: false };
        continue;
      }
      visitsUsed += 1;
      const result = await visit(candidate.url, type);
      const mismatch = result.ok && detectVisitMismatch(type, result.probe);
      if (result.ok && !mismatch) {
        finalPageTypes[type] = {
          ...candidate,
          visited: true,
          ...(result.title ? { title: result.title } : {}),
        };
      } else {
        failedTypes.set(type, mismatch ? 'visit-mismatch' : 'visit-failed');
        const failedPathname = normalizePathname(candidate.url);
        workingLinks = workingLinks.filter(
          (link) => normalizePathname(link.url) !== failedPathname,
        );
        excludedAny = true;
      }
    }
    if (!excludedAny) break; // усі pending або підтверджені, або бюджет вичерпано
  }

  const unresolved = ALL_TYPES.filter((type) => !finalPageTypes[type]).map(
    (type) => ({
      type,
      reason: failedTypes.get(type) ?? 'no-candidate',
    }),
  );

  return {
    schemaVersion: 2,
    startUrl,
    links: summarizeLinks(links),
    pageTypes: finalPageTypes,
    unresolved,
  };
}
