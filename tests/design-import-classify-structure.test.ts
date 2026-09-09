/**
 * Юніти структурного сигналу fan-out (`lib/classify-structure.mjs`,
 * інкремент Б.3, Фаза 2 Step 1). Чиста функція без браузера — вхід той самий,
 * що будує `classifyLinks`: мапа кандидатів за нормалізованим pathname.
 */
import { describe, expect, it } from 'vitest';
import {
  analyzeStructure,
  FANOUT_MIN_CHILDREN,
  structuralEvidence,
} from '../.agents/skills/redesign-from-reference/scripts/lib/classify-structure.mjs';

/** Мапа кандидатів у формі `classifyLinks` — для структури важливі лише ключі. */
function candidatesOf(...pathnames: string[]) {
  return new Map(
    pathnames.map((pathname) => [
      pathname,
      { url: `https://a.com${pathname}`, anchors: new Set<string>() },
    ]),
  );
}

describe('lib/classify-structure.mjs — analyzeStructure', () => {
  it('поріг — саме 3 прямі діти (константа експортована)', () => {
    expect(FANOUT_MIN_CHILDREN).toBe(3);
  });

  it('префікс із 3 дітьми-кандидатами отримує listing, діти — product', () => {
    const structure = analyzeStructure(
      candidatesOf('/wares', '/wares/a', '/wares/b', '/wares/c'),
    );
    expect(structure.get('/wares')).toEqual({ listing: true, childCount: 3 });
    for (const leaf of ['/wares/a', '/wares/b', '/wares/c']) {
      expect(structure.get(leaf)).toEqual({ product: true, childCount: 0 });
    }
  });

  it('двох дітей замало — ні listing, ні product', () => {
    const structure = analyzeStructure(
      candidatesOf('/wares', '/wares/a', '/wares/b'),
    );
    expect(structure.get('/wares')).toEqual({ childCount: 2 });
    expect(structure.get('/wares/a')).toEqual({ childCount: 0 });
  });

  it('корінь виключено: діти кореня не дають йому fan-out і самі не product', () => {
    const structure = analyzeStructure(
      candidatesOf('/', '/a', '/b', '/c', '/d'),
    );
    expect(structure.has('/')).toBe(false);
    for (const pathname of ['/a', '/b', '/c', '/d']) {
      expect(structure.get(pathname)).toEqual({ childCount: 0 });
    }
  });

  it('префікс, якого немає серед кандидатів, listing НЕ отримує — і його листи не product', () => {
    // `/shop` у наборі відсутній: у DOM його ніхто не лінкує, тож сторінкою він
    // може й не бути — вигадувати її зі структури не можна.
    const structure = analyzeStructure(
      candidatesOf('/shop/a', '/shop/b', '/shop/c'),
    );
    expect(structure.has('/shop')).toBe(false);
    for (const leaf of ['/shop/a', '/shop/b', '/shop/c']) {
      expect(structure.get(leaf)).toEqual({ childCount: 0 });
    }
  });

  it('рахуються ПРЯМІ діти, не всі нащадки', () => {
    // Онуки `/shop` (`/shop/men/*`) дітьми `/shop` не є — у нього рівно один
    // прямий нащадок `/shop/men`, тож fan-out не спрацьовує.
    const structure = analyzeStructure(
      candidatesOf('/shop', '/shop/men', '/shop/men/a', '/shop/men/b'),
    );
    expect(structure.get('/shop')).toEqual({ childCount: 1 });
    expect(structure.get('/shop/men')).toEqual({ childCount: 2 });
  });

  it('гілка з дітьми листом не вважається (product лише для бездітних)', () => {
    const structure = analyzeStructure(
      candidatesOf(
        '/c',
        '/c/a',
        '/c/b',
        '/c/deep',
        '/c/deep/x',
        '/c/deep/y',
        '/c/deep/z',
      ),
    );
    expect(structure.get('/c')).toEqual({ listing: true, childCount: 3 });
    // `/c/deep` — і дитина fan-out-префікса, і сам fan-out-префікс: листом він
    // не є (має власних дітей), тож бере listing, а не product.
    expect(structure.get('/c/deep')).toEqual({ listing: true, childCount: 3 });
    expect(structure.get('/c/a')).toEqual({ product: true, childCount: 0 });
  });

  it('результат не залежить від порядку вставки у вхідну мапу', () => {
    const forward = candidatesOf(
      '/wares',
      '/wares/a',
      '/wares/b',
      '/wares/c',
      '/about',
    );
    const shuffled = candidatesOf(
      '/wares/c',
      '/about',
      '/wares/a',
      '/wares',
      '/wares/b',
    );
    expect([...analyzeStructure(shuffled)]).toEqual([
      ...analyzeStructure(forward),
    ]);
    // Порядок ключів — лексикографічний, а не «як прийшло».
    expect([...analyzeStructure(shuffled).keys()]).toEqual([
      '/about',
      '/wares',
      '/wares/a',
      '/wares/b',
      '/wares/c',
    ]);
  });
});

describe('lib/classify-structure.mjs — structuralEvidence', () => {
  it('listing отримує count (розмір кущa), лист — ні (у нього нуль дітей)', () => {
    const structure = analyzeStructure(
      candidatesOf('/wares', '/wares/a', '/wares/b', '/wares/c'),
    );
    expect(structuralEvidence(structure.get('/wares'), 'listing')).toEqual({
      structural: 'prefix-fanout',
      count: 3,
      source: 'structure',
    });
    expect(structuralEvidence(structure.get('/wares/a'), 'product')).toEqual({
      structural: 'fanout-leaf',
      source: 'structure',
    });
  });

  it('чужий тип і відсутній запис дають null', () => {
    const structure = analyzeStructure(
      candidatesOf('/wares', '/wares/a', '/wares/b', '/wares/c'),
    );
    expect(structuralEvidence(structure.get('/wares'), 'product')).toBeNull();
    expect(structuralEvidence(structure.get('/wares/a'), 'listing')).toBeNull();
    expect(structuralEvidence(structure.get('/nope'), 'listing')).toBeNull();
  });
});
