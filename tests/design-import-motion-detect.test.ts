/**
 * Юніти ЧИСТОЇ частини motion-капчера (інкремент Б.2, Фаза 1, план Р4/Р6):
 * `detectMotionLibraries`, `suspectJsDriven` (`lib/motion-detect.mjs`) і
 * `diffReveal` (`lib/motion.mjs`). Браузер тут не потрібен принципово — саме
 * заради цього збір сирих маркерів і зіставлення з сигнатурами розведено по
 * різних модулях; файл має лишатись зеленим і без chromium.
 */
import { describe, expect, it } from 'vitest';
import {
  detectMotionLibraries,
  MOTION_GLOBALS,
  suspectJsDriven,
} from '../.agents/skills/redesign-from-reference/scripts/lib/motion-detect.mjs';
import { diffReveal } from '../.agents/skills/redesign-from-reference/scripts/lib/motion.mjs';

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

  it('MOTION_GLOBALS покриває всі глобали сигнатур', () => {
    for (const global of ['gsap', 'framerMotion', 'lottie', 'anime']) {
      expect(MOTION_GLOBALS).toContain(global);
      expect(
        detectMotionLibraries({ globals: [global] }).detected,
      ).toHaveLength(1);
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

  it('reveal порожній або нерухомий → підозри немає', () => {
    expect(suspectJsDriven()).toBe(false);
    expect(suspectJsDriven({ reveal: [{ animated: false }] })).toBe(false);
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
});
