/**
 * Побудова `sitemap-proposal.json` з уже зібраних лінків (задача §2.C.3-4,
 * план Р4/Р5). Чиста оркестрація — `classifyLinks` (Фаза 2, не переписуємо)
 * дає найкращого кандидата на тип; `visit` — інжектована async-функція
 * `(url) => Promise<{ok, title?}>` (у CLI — `page.goto`, у юніт-тестах —
 * фейк), тож логіка перепідбору тестується без браузера.
 *
 * 🔴 Кандидат, чий візит НЕ ok, НЕ лишається «знайденим»: його pathname
 * виключається з робочого набору лінків і `classifyLinks` перераховується —
 * тип отримує наступного за score кандидата, якщо він є (Р4). Цикл
 * завершується, коли черговий прохід нікого не виключив (стабілізація) —
 * лічильник виключень на ітерацію гарантує термінацію (лінків скінченна
 * кількість). Бюджет візитів (`maxVisits`) — спільний на ВСІ типи; кандидат
 * понад бюджет лишається знайденим, але чесно `visited: false`.
 */
import { classifyLinks, normalizePathname } from './classify.mjs';
import { URL_PATTERNS } from './classify-terms.mjs';

/** Усі канонічні типи сторінок — `home` (окреме правило в `classifyLinks`) + словник Фази 2. */
const ALL_TYPES = ['home', ...Object.keys(URL_PATTERNS)];

/**
 * @param {{
 *   links: Array<{ url: string, anchors: string[] }>,
 *   startUrl: string,
 *   maxVisits: number,
 *   visit: (url: string) => Promise<{ ok: boolean, title?: string | null }>,
 * }} params
 * @returns {Promise<{
 *   schemaVersion: 1, startUrl: string, linksSeen: number,
 *   pageTypes: Record<string, { url: string, score: number, evidence: unknown[], visited: boolean, title?: string }>,
 *   unresolved: Array<{ type: string, reason: 'no-candidate' | 'visit-failed' }>,
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
  const failedTypes = new Set();
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
      const result = await visit(candidate.url);
      if (result.ok) {
        finalPageTypes[type] = {
          ...candidate,
          visited: true,
          ...(result.title ? { title: result.title } : {}),
        };
      } else {
        failedTypes.add(type);
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
      reason: failedTypes.has(type) ? 'visit-failed' : 'no-candidate',
    }),
  );

  return {
    schemaVersion: 1,
    startUrl,
    linksSeen: links.length,
    pageTypes: finalPageTypes,
    unresolved,
  };
}
