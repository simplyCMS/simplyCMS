/**
 * Юніти ЧИСТОЇ частини motion-капчера (інкремент Б.2, Фаза 1, план Р4/Р6):
 * `detectMotionLibraries`, `suspectJsDriven` (`lib/motion-detect.mjs`) і
 * `diffReveal` і `captureReveal` (`lib/motion.mjs`). Браузер тут не потрібен
 * принципово — саме заради цього збір сирих маркерів і зіставлення з
 * сигнатурами розведено по різних модулях; файл має лишатись зеленим і без
 * chromium. `captureReveal` бере `page` параметром, тож і вона тестується
 * фейком — без Playwright.
 */
import { describe, expect, it } from 'vitest';
import {
  detectMotionLibraries,
  MOTION_GLOBALS,
  SIGNATURES,
  suspectJsDriven,
} from '../.agents/skills/redesign-from-reference/scripts/lib/motion-detect.mjs';
import { browserRevealSnapshot } from '../.agents/skills/redesign-from-reference/scripts/lib/browser-reveal.mjs';
import {
  captureReveal,
  diffReveal,
} from '../.agents/skills/redesign-from-reference/scripts/lib/motion.mjs';

describe('lib/motion-detect.mjs — detectMotionLibraries', () => {
  it('gsap за src скрипта', () => {
    const result = detectMotionLibraries({
      scriptSrcs: ['https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js'],
    });
    expect(result.detected).toEqual(['gsap']);
    expect(result.markers).toEqual([
      'script:https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js',
    ]);
  });

  it('anime.js за src, lottie за глобалом, framer-motion за data-атрибутом', () => {
    const result = detectMotionLibraries({
      scriptSrcs: ['https://cdn.example/animejs/3.2.1/anime.min.js'],
      globals: ['bodymovin'],
      dataAttributes: ['data-framer-appear-id', 'data-testid'],
    });
    expect(result.detected).toEqual(['anime.js', 'framer-motion', 'lottie']);
    expect(result.markers).toContain('global:bodymovin');
    expect(result.markers).toContain('data:data-framer-appear-id');
    expect(result.markers).not.toContain('data:data-testid');
  });

  it('порожній вхід і невідомі маркери — порожній результат, а не крах', () => {
    expect(detectMotionLibraries()).toEqual({ detected: [], markers: [] });
    expect(
      detectMotionLibraries({
        scriptSrcs: ['https://cdn.example/jquery.min.js'],
        globals: ['jQuery'],
        dataAttributes: ['data-id'],
      }),
    ).toEqual({ detected: [], markers: [] });
  });

  it('дублі схлопуються, вихід відсортований (детермінізм)', () => {
    const result = detectMotionLibraries({
      scriptSrcs: ['https://cdn.example/gsap.min.js'],
      globals: ['gsap', 'ScrollTrigger', 'gsap'],
    });
    expect(result.detected).toEqual(['gsap']);
    expect(result.markers).toEqual([
      'global:ScrollTrigger',
      'global:gsap',
      'script:https://cdn.example/gsap.min.js',
    ]);
  });

  // 🔴 Регекси сигнатур не мають прапорця `g` — інакше `test` тягнув би
  // `lastIndex` і на другому виклику з тим самим рядком повертав false.
  it('повторний виклик із тим самим входом дає той самий результат', () => {
    const raw = { scriptSrcs: ['https://cdn.example/gsap.min.js'] };
    expect(detectMotionLibraries(raw)).toEqual(detectMotionLibraries(raw));
  });

  // 🔴 Інваріант, а не спот-чек: `motion.mjs` передає в `page.evaluate` саме
  // `MOTION_GLOBALS`, тож глобал, присутній у сигнатурі, але відсутній у
  // списку проби, НІКОЛИ не питається у сторінки — детекція тихо сліпне на
  // цілу бібліотеку (GSAP під `TweenMax`, framer-motion під `Motion`).
  // Зворотний бік теж перевіряємо: зайвий кандидат — мертва проба.
  it('MOTION_GLOBALS ≡ множина глобалів усіх сигнатур', () => {
    const signatures = SIGNATURES as { name: string; globals: string[] }[];
    const fromSignatures = [
      ...new Set(signatures.flatMap((signature) => signature.globals)),
    ].sort();

    expect(fromSignatures.length).toBeGreaterThan(0);
    for (const global of fromSignatures) {
      expect(MOTION_GLOBALS).toContain(global);
    }
    expect([...MOTION_GLOBALS].sort()).toEqual(fromSignatures);

    // І кожен кандидат атрибутується ОДНОЗНАЧНО: той самий глобал у двох
    // сигнатурах дав би дві «виявлені» бібліотеки з одного маркера.
    for (const global of MOTION_GLOBALS) {
      expect(detectMotionLibraries({ globals: [global] }).detected).toEqual([
        signatures.find((s) => s.globals.includes(global))!.name,
      ]);
    }
  });
});

describe('lib/motion-detect.mjs — suspectJsDriven (Р6)', () => {
  const animated = [{ animated: true }];

  it('reveal є, CSS-механізму не видно → підозра на JS', () => {
    expect(suspectJsDriven({ reveal: animated })).toBe(true);
  });

  it('transition по opacity пояснює reveal → підозри немає', () => {
    expect(
      suspectJsDriven({
        reveal: animated,
        transitions: [{ property: 'opacity' }],
      }),
    ).toBe(false);
  });

  it('`all` теж пояснення; @keyframes — теж', () => {
    expect(
      suspectJsDriven({ reveal: animated, transitions: [{ property: 'all' }] }),
    ).toBe(false);
    expect(
      suspectJsDriven({ reveal: animated, keyframes: { names: ['fade'] } }),
    ).toBe(false);
  });

  it('transition по нерелевантній властивості reveal НЕ пояснює', () => {
    expect(
      suspectJsDriven({
        reveal: animated,
        transitions: [{ property: 'background-color' }],
      }),
    ).toBe(true);
  });

  // 🔴 Три стани, а не два (V-5): «вибірки не було» ≠ «перевірено, підозри
  // немає». До Б.3 обидва випадки віддавали `false`, і сліпий reveal-корінь
  // (сторінка без `<main>`) читався як чиста сторінка.
  it('вибірка є, але нерухома → чесний false', () => {
    expect(suspectJsDriven({ reveal: [{ animated: false }] })).toBe(false);
  });

  it('нульова вибірка → unknown, а не false', () => {
    expect(suspectJsDriven()).toBe('unknown');
    expect(suspectJsDriven({ reveal: [] })).toBe('unknown');
    // Навіть коли CSS-механізм на сторінці видно: пояснювати нічого — reveal
    // не міряли взагалі.
    expect(
      suspectJsDriven({ reveal: [], transitions: [{ property: 'opacity' }] }),
    ).toBe('unknown');
  });

  it('три стани попарно різні (саме розрізненність і є вимогою)', () => {
    const states = [
      suspectJsDriven({ reveal: [{ animated: true }] }),
      suspectJsDriven({ reveal: [{ animated: false }] }),
      suspectJsDriven({ reveal: [] }),
    ];
    expect(states).toEqual([true, false, 'unknown']);
    expect(new Set(states).size).toBe(3);
  });
});

describe('lib/motion.mjs — diffReveal (Р4)', () => {
  const before = [
    {
      index: 0,
      tag: 'section',
      selector: 'section.hero',
      opacity: 1,
      transform: 'none',
    },
    {
      index: 1,
      tag: 'section',
      selector: 'section.reveal',
      opacity: 0,
      transform: 'matrix(1, 0, 0, 1, 0, 32)',
    },
  ];

  it('дельта opacity ≥ 0.2 або зміна transform → animated', () => {
    const after = [
      {
        index: 0,
        tag: 'section',
        selector: 'section.hero',
        opacity: 1,
        transform: 'none',
      },
      {
        index: 1,
        tag: 'section',
        selector: 'section.reveal.is-visible',
        opacity: 1,
        transform: 'none',
      },
    ];
    const diff = diffReveal(before, after);
    expect(diff.map((d) => d.animated)).toEqual([false, true]);
    expect(diff[1].transformChanged).toBe(true);
    expect(diff[1].opacityBefore).toBe(0);
    expect(diff[1].opacityAfter).toBe(1);
    // Метадані — зі знімка ДО: після розкриття класи вузла вже інші.
    expect(diff[1].selector).toBe('section.reveal');
  });

  it('дельта opacity нижче порога і без transform → не animated', () => {
    const after = [
      {
        index: 0,
        tag: 'section',
        selector: 'section.hero',
        opacity: 0.9,
        transform: 'none',
      },
      { ...before[1], opacity: 0.1 },
    ];
    expect(diffReveal(before, after).map((d) => d.animated)).toEqual([
      false,
      false,
    ]);
  });

  it('порядок «після» не впливає — пари зводяться за index, вихід сортований', () => {
    const shuffled = [
      {
        index: 1,
        tag: 'section',
        selector: 'x',
        opacity: 1,
        transform: 'none',
      },
      {
        index: 0,
        tag: 'section',
        selector: 'x',
        opacity: 1,
        transform: 'none',
      },
    ];
    const diff = diffReveal(before, shuffled);
    expect(diff.map((d) => d.index)).toEqual([0, 1]);
    expect(diff.map((d) => d.animated)).toEqual([false, true]);
  });

  it('вузол зник зі знімка «після» — беремо стан «до», без краху', () => {
    const diff = diffReveal(before, []);
    expect(diff.map((d) => d.animated)).toEqual([false, false]);
    expect(diff[1].opacityAfter).toBe(0);
  });

  // 🔴 Не плутати з кейсом вище: там порожній лише знімок «після» (вузли
  // зникли), тут порожня САМА вибірка — і діф чесно порожній, бо міряти не
  // було чого. Саме цей нуль `suspectJsDriven` тлумачить як `'unknown'`.
  it('нульова вибірка → порожній діф (не крах і не вигадані записи)', () => {
    expect(diffReveal([], [])).toEqual([]);
  });
});

describe('lib/motion.mjs — captureReveal: обсяг вибірки зі знімка ДО', () => {
  /** Вузол reveal-знімка; значення нерухомі — предмет тут лише кількість. */
  function node(index: number) {
    return {
      index,
      tag: 'section',
      selector: `section.s${index}`,
      opacity: 1,
      transform: 'none',
    };
  }

  /**
   * Фейкова `page`: на `browserRevealSnapshot` віддає чергові знімки, на все
   * інше (це виклики `scrollThrough`) — обʼєкт із розмірами, який той уміє і
   * зруйнувати деструктуризацією, і прочитати як «доскролили до низу».
   */
  function fakePage(snapshots: ReturnType<typeof node>[][]) {
    let taken = 0;
    return {
      async evaluate(fn: unknown) {
        if (fn === browserRevealSnapshot)
          return { root: 'main', nodes: snapshots[taken++] ?? [] };
        return { scrollHeight: 1000, viewportHeight: 800 };
      },
      async waitForTimeout() {},
    };
  }

  // 🔴 Мутаційний контроль: замініть у `captureReveal` `before.nodes.length`
  // на `after.nodes.length` — і цей тест почервоніє. Асерт
  // `sampled === reveal.length` таким не є: `diffReveal` — це `before.map(…)`,
  // тобто довжини тотожні за конструкцією й мутанта не ловлять.
  it('секція, що зʼявилась ПІД ЧАС скролу, обсяг вибірки не роздуває', async () => {
    const before = [node(0), node(1), node(2)];
    // Знімок «після» більший: ліниву секцію дописав IntersectionObserver.
    const after = [...before, node(3), node(4)];

    const capture = await captureReveal(fakePage([before, after]));

    expect(capture.sampled).toBe(3);
    expect(capture.sampled).not.toBe(after.length);
    // Діф будується рівно на семпльованих вузлах — доважки з «після» в ньому
    // не зʼявляються (їх ні з чим порівнювати).
    expect(capture.entries.map((entry) => entry.index)).toEqual([0, 1, 2]);
    expect(capture.root).toBe('main');
  });

  it('нульова вибірка ДО — sampled 0, навіть якщо після скролу вузли зʼявились', async () => {
    const capture = await captureReveal(fakePage([[], [node(0), node(1)]]));

    expect(capture.sampled).toBe(0);
    expect(capture.entries).toEqual([]);
  });
});
