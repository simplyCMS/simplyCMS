/**
 * Побудова `sitemap-proposal.json` з уже зібраних лінків (задача §2.C.3-4,
 * план Р4/Р5). Чиста оркестрація — `classifyLinks` (Фаза 2, не переписуємо)
 * дає найкращого кандидата на тип; `visit` — інжектована async-функція
 * `(url, type) => Promise<{ok, title?, probe?}>` (у CLI — `page.goto` плюс
 * `browserVisitProbe`, у юніт-тестах — фейк), тож і перепідбір, і
 * контент-верифікація тестуються без браузера.
 *
 * 🔴 Провалів візиту два роди, і виключення в них РІЗНІ за обсягом.
 * `visit-failed` (не-2xx або мережева помилка) — сторінки немає ні для кого,
 * тож її pathname вибуває з робочого набору лінків цілком. `visit-mismatch`
 * (сторінка відкрилась, але зміст суперечить типу — `detectVisitMismatch`)
 * навпаки: «це не картка товару, а сітка» — ПОЗИТИВНИЙ доказ на користь
 * `listing`, і глобальне вирізання знищило б доказ разом із помилкою. Тому
 * блокується лише пара (тип, pathname) — `blockedPairs` віддається
 * `classifyLinks`, і той самий pathname лишається доступним іншим типам.
 *
 * 🔴 Кандидат, чий візит НЕ ok, НЕ лишається «знайденим»: `classifyLinks`
 * перераховується — тип отримує наступного за score кандидата, якщо він є
 * (Р4). Цикл завершується, коли черговий прохід нікого не виключив
 * (стабілізація). 🔴 Термінацію дають ДВА факти, і жоден із них — не гард
 * `excludedAny`: кожна ітерація з провалом витрачає ≥1 візит, а на
 * `visitsUsed >= maxVisits` усі `pending` фіналізуються як `visited: false`,
 * тож наступний прохід має порожній `pending`; плюс множина пар
 * (тип, pathname) скінченна. Перевірки «виключення справді НОВЕ» — захисні:
 * `classifyLinks` заблоковану пару вдруге не пропонує, тож повторного
 * блокування на нинішній семантиці не буває (доведено інструментацією в
 * ревʼю). Бюджет візитів (`maxVisits`) — спільний на ВСІ типи; кандидат
 * понад бюджет лишається знайденим, але чесно `visited: false`.
 *
 * 🔴 `schemaVersion: 2` (інкремент Б.3, Р4/V-3): голе число `linksSeen`
 * ЗАМІНЕНО масивом `links` — саме те, що бачив класифікатор, включно зі
 * стартовим pathname (той є кандидатом навіть без вхідних лінків на себе).
 * Без цього поля діагностика помилки класифікації вимагала власного зонда: з
 * пропозиції не було видно ні які pathname зібрано, ні з якими якорями.
 */
import { classifyLinks, normalizePathname } from './classify.mjs';
import { URL_PATTERNS } from './classify-terms.mjs';
import { detectVisitMismatch } from './visit-probe.mjs';
import { summarizeLinks } from './sitemap-links.mjs';

// 2 (інкремент Б.3, Р4/V-3) — голе число `linksSeen` ЗАМІНЕНО масивом `links`.
// 🔴 Це ТРЕТІЙ незалежний лічильник версій інструмента, і плутати їх не можна:
// `lib/inspect-page.mjs` версіонує `inspection.json` (вхід інспекції),
// `lib/map.mjs` — `tokens-proposal.json` (вихід мапінгу), тут —
// `sitemap-proposal.json` (вихід дискаверера). Рухаються незалежно.
const SCHEMA_VERSION = 2;

/** Усі канонічні типи сторінок — `home` (окреме правило в `classifyLinks`) + словник Фази 2. */
const ALL_TYPES = ['home', ...Object.keys(URL_PATTERNS)];

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
 *   schemaVersion: typeof SCHEMA_VERSION, startUrl: string,
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
  /** pathname → типи, спростовані пробом саме для цієї сторінки (Б.3, фікс рев'ю). */
  const blockedPairs = new Map();
  let visitsUsed = 0;

  for (;;) {
    const { pageTypes } = classifyLinks(workingLinks, startUrl, blockedPairs);
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
      } else if (mismatch) {
        failedTypes.set(type, 'visit-mismatch');
        const pathname = normalizePathname(candidate.url);
        const blocked = blockedPairs.get(pathname) ?? new Set();
        if (!blocked.has(type)) {
          blocked.add(type);
          blockedPairs.set(pathname, blocked);
          excludedAny = true;
        }
      } else {
        failedTypes.set(type, 'visit-failed');
        const failedPathname = normalizePathname(candidate.url);
        const before = workingLinks.length;
        workingLinks = workingLinks.filter(
          (link) => normalizePathname(link.url) !== failedPathname,
        );
        if (workingLinks.length < before) excludedAny = true;
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
    schemaVersion: SCHEMA_VERSION,
    startUrl,
    links: summarizeLinks(links, startUrl),
    pageTypes: finalPageTypes,
    unresolved,
  };
}
