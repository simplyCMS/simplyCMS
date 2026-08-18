// @vitest-environment jsdom
/**
 * Юніти вибору reveal-кореня (`browserRevealSnapshot` із
 * `lib/browser-reveal.mjs`, інкремент Б.3, план Р6 / знахідка V-5).
 *
 * 🔴 Навіщо ДРУГИЙ файл поруч із `design-import-motion-root.test.ts`: той
 * browser-gated (`describe.skipIf(!browser)`), а CI браузера не ставить —
 * тобто регресія кореня доїхала б до `main` зеленою (та сама зона, про яку
 * попереджає `docs/architecture/test-contours.md` §4.7). Логіка вибору
 * кандидатів — чистий обхід DOM, тож jsdom її доводить у звичайному прогоні
 * `pnpm test`. Браузерний файл лишається: він доводить `getComputedStyle`
 * наживо, чого jsdom не вміє.
 */
import { describe, expect, it } from 'vitest';
import { browserRevealSnapshot } from '../.agents/skills/redesign-from-reference/scripts/lib/browser-reveal.mjs';

interface Snapshot {
  root: 'main' | 'body-fallback';
  nodes: { index: number; tag: string; selector: string; opacity: number }[];
}

/** Замінити вміст `body` фікстурою й зняти знімок у контексті цього документа. */
function snapshot(html: string): Snapshot {
  document.body.innerHTML = html;
  return browserRevealSnapshot() as Snapshot;
}

describe('lib/browser-reveal.mjs — корінь вибірки', () => {
  it('є <main> → корінь main, беруться його ПРЯМІ діти', () => {
    const { root, nodes } = snapshot(`
      <header class="site"><div class="logo"></div></header>
      <main>
        <section class="hero"><div class="inner"></div></section>
        <section class="grid"></section>
      </main>
      <footer class="foot"></footer>
    `);

    expect(root).toBe('main');
    // Ні `header`/`footer` поза `main`, ні внутрішній `div.inner` — рівно два
    // прямі діти: reveal — секційний канал, а не обхід усього DOM.
    expect(nodes.map((n) => n.selector)).toEqual([
      'section.hero',
      'section.grid',
    ]);
  });

  it('без <main> — секції верхнього рівня ПЛЮС діти обгорток, у DOM-порядку', () => {
    // 🔴 Негативний контроль: поверніть плаский `body > section` — і масив
    // стисне до однієї `section.hero`, тобто саме той нуль-вимір, через який
    // канал мовчав на референсі прогону №2 (V-5).
    const { root, nodes } = snapshot(`
      <div class="top"><nav class="menu"></nav></div>
      <section class="hero"></section>
      <div class="wrap">
        <section class="a"></section>
        <section class="b"></section>
      </div>
    `);

    expect(root).toBe('body-fallback');
    expect(nodes.map((n) => n.selector)).toEqual([
      'nav.menu',
      'section.hero',
      'section.a',
      'section.b',
    ]);
    // Індекс — позиція у ВИБІРЦІ (за ним `diffReveal` зводить пари «до/після»).
    expect(nodes.map((n) => n.index)).toEqual([0, 1, 2, 3]);
  });

  it('невізуальні теги у fallback-ярусі відкидаються', () => {
    const { nodes } = snapshot(`
      <script>window.x = 1;</script>
      <div class="wrap">
        <script>window.y = 2;</script>
        <style>.a { color: red }</style>
        <noscript><span>nojs</span></noscript>
        <template><section class="tpl"></section></template>
        <section class="real"></section>
      </div>
    `);

    expect(nodes.map((n) => n.selector)).toEqual(['section.real']);
  });

  it('стеля вибірки — 60 вузлів', () => {
    const children = Array.from(
      { length: 80 },
      (_, i) => `<section class="s${i}"></section>`,
    ).join('');
    const { nodes } = snapshot(`<div class="wrap">${children}</div>`);

    // Кожен вузол — це `getComputedStyle` двічі за інспекцію плюс серіалізація
    // в Node; обгортко-важка розмітка легко дає сотні кандидатів.
    expect(nodes).toHaveLength(60);
    expect(nodes.at(-1)?.selector).toBe('section.s59');
  });

  it('порожній body → нульова вибірка, а не помилка', () => {
    const { root, nodes } = snapshot('');

    expect(root).toBe('body-fallback');
    expect(nodes).toEqual([]);
  });

  it('селектор несе id і всі класи, opacity — число навіть без стилю', () => {
    const { nodes } = snapshot(
      '<main><section id="hero" class="a b" style="opacity: 0.25"></section>' +
        '<section></section></main>',
    );

    expect(nodes[0].selector).toBe('section#hero.a.b');
    expect(nodes[0].opacity).toBe(0.25);
    // Незадана `opacity` не має ставати `NaN` — інакше дельта в `diffReveal`
    // перестала б бути числом і `animated` мовчки збрехав би.
    expect(nodes[1].opacity).toBe(1);
  });
});
