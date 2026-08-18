/**
 * Класифікатор лінків сайту на канонічні типи сторінок (задача §2.C.2, план
 * Р3/Р3b/Р5). Чиста функція без браузера — вхід уже зібраний DOM-обходом
 * `discover.mjs` (Фаза 3): пара `{url, anchors}` на лінк, де `anchors` —
 * АГРЕГОВАНІ тексти лінка (textContent + aria-label + title + img[alt] —
 * іконковий лінк без видимого тексту читається саме звідси, Р3b).
 *
 * Джерел evidence три: URL-патерни й тексти якорів (словники —
 * `classify-terms.mjs`) плюс структурний fan-out (`classify-structure.mjs`,
 * інкремент Б.3). Збірка й ранжування пар (тип, url) — `classify-pairs.mjs`;
 * тут лишається сама стратегія вибору.
 *
 * Шкала (Р3): кожен сигнал +2, поріг ≥2 — кожен сигнал сам закриває тип.
 * Вибір — глобально-жадібний по всіх парах (type,url): перший
 * непроконфліктований прохід відсортованого списку закриває і тип, і URL —
 * програвший тип бере наступну свою пару нижче в списку (перепідбір —
 * побічний ефект одного проходу, не окремий крок).
 */
import { analyzeStructure } from './classify-structure.mjs';
import { OTHER_TYPES, rankedPairs } from './classify-pairs.mjs';

/** Нормалізація pathname: без query/hash, без trailing slash, без `index.html` (Р3b). */
export function normalizePathname(input) {
  let pathname;
  try {
    pathname = new URL(input).pathname;
  } catch {
    pathname = input.split('#')[0].split('?')[0];
  }
  pathname = pathname.replace(/\/index\.html?$/i, '/');
  if (pathname.length > 1) pathname = pathname.replace(/\/+$/, '');
  return pathname || '/';
}

/**
 * Класифікувати лінки на типи сторінок.
 * @param {Array<{url: string, anchors?: string[]}>} links
 * @param {string} startUrl
 * @returns {{
 *   pageTypes: Record<string, { url: string, score: number, evidence: Array<{urlPattern?: string, anchorMatch?: string, structural?: string, count?: number, source: 'anchor'|'aria'|'url'|'structure'}> }>,
 *   unresolved: Array<{ type: string, reason: 'no-candidate' }>,
 * }}
 */
export function classifyLinks(links, startUrl) {
  const startPathname = normalizePathname(startUrl);

  // Р3b: групування по нормалізованому pathname — агрегація ВСІХ якірних текстів.
  const candidates = new Map();
  const register = (url, anchors) => {
    const pathname = normalizePathname(url);
    const texts = (anchors ?? []).map((a) => a.trim()).filter(Boolean);
    const existing = candidates.get(pathname);
    if (existing) texts.forEach((t) => existing.anchors.add(t));
    else candidates.set(pathname, { url, anchors: new Set(texts) });
  };
  for (const link of links) register(link.url, link.anchors);
  // Стартовий URL — теж кандидат (навіть без вхідних лінків на себе, для home-фолбека).
  if (!candidates.has(startPathname))
    candidates.set(startPathname, { url: startUrl, anchors: new Set() });

  const pageTypes = {};
  const closedTypes = new Set(['home']);
  const closedPathnames = new Set();

  // home — окреме детерміноване правило: корінь, якщо він серед кандидатів, інакше стартовий URL.
  const root = candidates.get('/');
  if (root) {
    pageTypes.home = {
      url: root.url,
      score: 2,
      evidence: [{ urlPattern: '/', source: 'url' }],
    };
    closedPathnames.add('/');
  } else {
    pageTypes.home = { url: startUrl, score: 0, evidence: [{ source: 'url' }] };
    closedPathnames.add(startPathname);
  }

  // Структурний розбір рахується по ПОВНОМУ набору кандидатів (разом із уже
  // закритим коренем): форма сайту не залежить від того, який тип що забрав.
  const structure = analyzeStructure(candidates);

  for (const pair of rankedPairs(candidates, structure, closedPathnames)) {
    if (closedTypes.has(pair.type) || closedPathnames.has(pair.pathname))
      continue;
    pageTypes[pair.type] = {
      url: pair.url,
      score: pair.score,
      evidence: pair.evidence,
    };
    closedTypes.add(pair.type);
    closedPathnames.add(pair.pathname);
  }

  const unresolved = OTHER_TYPES.filter((type) => !closedTypes.has(type)).map(
    (type) => ({
      type,
      reason: 'no-candidate',
    }),
  );

  return { pageTypes, unresolved };
}
