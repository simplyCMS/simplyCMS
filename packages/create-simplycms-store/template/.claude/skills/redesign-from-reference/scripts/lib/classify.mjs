/**
 * Класифікатор лінків сайту на канонічні типи сторінок (задача §2.C.2, план
 * Р3/Р3b/Р5). Чиста функція без браузера — вхід уже зібраний DOM-обходом
 * `discover.mjs` (Фаза 3): пара `{url, anchors}` на лінк, де `anchors` —
 * АГРЕГОВАНІ тексти лінка (textContent + aria-label + title + img[alt] —
 * іконковий лінк без видимого тексту читається саме звідси, Р3b). Словники
 * URL-патернів/якірних термінів — `classify-terms.mjs`.
 *
 * Шкала (Р3): URL-патерн +2, текст якоря +2, поріг ≥2 — кожен сигнал сам
 * закриває тип. Вибір — глобально-жадібний по всіх парах (type,url):
 * стабільне сортування (score↓ → type-aware глибина `depthKey` → лексикографічно),
 * перший непроконфліктований прохід закриває і тип, і URL — програвший тип
 * бере наступну свою пару нижче в списку (перепідбір — побічний ефект
 * одного проходу, не окремий крок). Зіставлення патернів/термінів —
 * `classify-terms.mjs`.
 */
import {
  matchAnchorTerm,
  matchUrlPattern,
  URL_PATTERNS,
} from './classify-terms.mjs';

const OTHER_TYPES = Object.keys(URL_PATTERNS);

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
 * Type-aware компонент довжини для тайбрейка при рівному балі (Р2, Б.3):
 * картка товару має slug, тож для `product` виграє ГЛИБШИЙ pathname, для решти
 * типів — коротший, як було. 🔴 Це ключ ОДНОГО елемента, а не попарна умова
 * «якщо обидва product»: попарна версія не транзитивна (дає цикл A<B<C<A), і
 * поведінка `Array#sort` на ній стає невизначеною. Наслідок, який і лагодить
 * кейс deo: при рівному балі product-пари йдуть ПЕРЕД усіма іншими (відʼємний
 * ключ < додатного), а між собою — глибша першою; тому картка
 * `/product/<slug>` закриває тип `product` РАНІШЕ, ніж розглядається мілкий
 * `/product`, і той дістається listing.
 * @param {{type: string, pathname: string}} pair
 */
function depthKey(pair) {
  return pair.type === 'product' ? -pair.pathname.length : pair.pathname.length;
}

/**
 * Класифікувати лінки на типи сторінок.
 * @param {Array<{url: string, anchors?: string[]}>} links
 * @param {string} startUrl
 * @returns {{
 *   pageTypes: Record<string, { url: string, score: number, evidence: Array<{urlPattern?: string, anchorMatch?: string, source: 'anchor'|'aria'|'url'}> }>,
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

  // Усі пари (type,url) з ненульовим score — крім кореня, який home уже забрав.
  const pairs = [];
  for (const [pathname, candidate] of candidates) {
    if (closedPathnames.has(pathname)) continue;
    for (const type of OTHER_TYPES) {
      const urlMatch = matchUrlPattern(type, pathname);
      const anchorMatch = matchAnchorTerm(type, candidate.anchors);
      const evidence = [
        urlMatch && { urlPattern: urlMatch, source: 'url' },
        anchorMatch && { anchorMatch, source: 'anchor' },
      ].filter(Boolean);
      if (evidence.length > 0) {
        pairs.push({
          type,
          pathname,
          url: candidate.url,
          score: evidence.length * 2,
          evidence,
        });
      }
    }
  }

  // Стабільне сортування (score↓ → depthKey↑ → лексикографічно) + жадібний вибір.
  pairs.sort(
    (a, b) =>
      b.score - a.score ||
      depthKey(a) - depthKey(b) ||
      a.pathname.localeCompare(b.pathname),
  );
  for (const pair of pairs) {
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
