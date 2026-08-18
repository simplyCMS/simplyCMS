/**
 * Збірка й ранжування пар (тип, url) для `classify.mjs` (інкремент Б.3,
 * Фаза 2). Винесено з `classify.mjs` тоді, коли до двох джерел evidence
 * (URL-патерн, якір) додалось третє — структурний fan-out: канон 150 рядків
 * не дозволяє тримати в одному файлі і збірку пар, і жадібний вибір.
 *
 * Шкала (Р1, незмінна): кожен сигнал +2, `score = evidence.length * 2`,
 * поріг ≥2 — один сигнал сам закриває тип. Сортування — стабільне:
 * score↓ → type-aware глибина `depthKey` → лексикографічно за pathname.
 */
import {
  matchAnchorTerm,
  matchUrlPattern,
  URL_PATTERNS,
} from './classify-terms.mjs';
import { structuralEvidence } from './classify-structure.mjs';

/** Типи, які добираються скорингом (`home` має окреме правило в `classify.mjs`). */
export const OTHER_TYPES = Object.keys(URL_PATTERNS);

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
 * Усі пари (тип, url) з ненульовим score, відсортовані за пріоритетом вибору.
 * @param {Map<string, { url: string, anchors: Set<string> }>} candidates
 * @param {Map<string, { listing?: true, product?: true, childCount: number }>} structure
 *   результат `analyzeStructure` — третє джерело evidence
 * @param {Set<string>} closedPathnames pathname-и, уже зайняті іншим типом
 * @returns {Array<{ type: string, pathname: string, url: string, score: number, evidence: object[] }>}
 */
export function rankedPairs(candidates, structure, closedPathnames) {
  const pairs = [];
  for (const [pathname, candidate] of candidates) {
    if (closedPathnames.has(pathname)) continue;
    for (const type of OTHER_TYPES) {
      const urlMatch = matchUrlPattern(type, pathname);
      const anchorMatch = matchAnchorTerm(type, candidate.anchors);
      const evidence = [
        urlMatch && { urlPattern: urlMatch, source: 'url' },
        anchorMatch && { anchorMatch, source: 'anchor' },
        structuralEvidence(structure.get(pathname), type),
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

  pairs.sort(
    (a, b) =>
      b.score - a.score ||
      depthKey(a) - depthKey(b) ||
      a.pathname.localeCompare(b.pathname),
  );
  return pairs;
}
