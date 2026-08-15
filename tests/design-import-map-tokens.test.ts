import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  hslTriple,
  parseColor,
  parseHslTriple,
  relativeLuminance,
  rgbToHsl,
} from '../scripts/design-import/lib/color.mjs';
import {
  CLUSTER_THRESHOLD,
  clusterColors,
} from '../scripts/design-import/lib/cluster.mjs';
import {
  AA_MIN_RATIO,
  checkContrastPairs,
} from '../scripts/design-import/lib/contrast.mjs';
import { mapTokens } from '../scripts/design-import/lib/map.mjs';
import { applyTokens } from '@simplycms/themes/applyTokens';
import { validateThemeModule } from '@simplycms/themes/validateThemeModule';
import { sampleInspection } from './fixtures/design-import/inspection.fixture.mjs';

// Формат токена контракту тем (`packages/theme-system/src/types.ts`):
// HSL-трійка без `hsl()`, напр. `"221 83% 53%"`. Ключі-виняток — не колір.
const HSL_TRIPLE_REGEX = /^\d+(\.\d+)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%$/;
const NON_COLOR_KEYS = new Set(['radius', 'font-sans', 'font-heading', 'dark']);

describe('lib/color.mjs — парсинг і WCAG-математика', () => {
  it('парсить #hex і rgb()/rgba() у ту саму RGB-форму', () => {
    expect(parseColor('#ffffff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('#000')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    expect(parseColor('rgb(37, 99, 235)')).toEqual({
      r: 37,
      g: 99,
      b: 235,
      a: 1,
    });
    expect(parseColor('rgba(37, 99, 235, 0.5)')).toEqual({
      r: 37,
      g: 99,
      b: 235,
      a: 0.5,
    });
    expect(parseColor('not-a-color')).toBeNull();
  });

  it('rgbToHsl/hslToRgb — узгоджені round-trip для відомого кольору', () => {
    const rgb = { r: 37, g: 99, b: 235 };
    const hsl = rgbToHsl(rgb);
    expect(hsl).toEqual({ h: 221, s: 83, l: 53 });
    expect(hslTriple(hsl)).toBe('221 83% 53%');
    expect(parseHslTriple('221 83% 53%')).toEqual(hsl);
  });

  it('чорний/білий — максимальний контраст 21:1', () => {
    const ratio = contrastRatio(
      { r: 0, g: 0, b: 0 },
      { r: 255, g: 255, b: 255 },
    );
    expect(Math.round(ratio)).toBe(21);
  });

  it('однаковий колір — контраст 1:1 (relativeLuminance симетрична)', () => {
    const gray = { r: 128, g: 128, b: 128 };
    expect(relativeLuminance(gray)).toBeGreaterThan(0);
    expect(contrastRatio(gray, gray)).toBeCloseTo(1, 5);
  });

  it('AA-межа: відомий провал і відомий прохід', () => {
    // Сірий-на-сірому — свідомо провальна пара (< 4.5).
    const fail = contrastRatio(
      { r: 150, g: 150, b: 150 },
      { r: 180, g: 180, b: 180 },
    );
    expect(fail).toBeLessThan(AA_MIN_RATIO);
    // Чорний текст на білому — свідомо прохідна пара (>> 4.5).
    const pass = contrastRatio(
      { r: 0, g: 0, b: 0 },
      { r: 255, g: 255, b: 255 },
    );
    expect(pass).toBeGreaterThan(AA_MIN_RATIO);
  });
});

describe('lib/cluster.mjs — кластеризація за HSL-відстанню', () => {
  it('зливає близькі відтінки (антиаліасинг/hover) в один кластер', () => {
    const clusters = clusterColors([
      { value: '#2563eb', frequency: 40, area: 1000 },
      { value: '#2660e8', frequency: 10, area: 200 }, // майже той самий синій
    ]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].frequency).toBe(50);
  });

  it('лишає різні бренд-кольори окремими кластерами', () => {
    const clusters = clusterColors([
      { value: '#2563eb', frequency: 40, area: 1000 },
      { value: '#7c3aed', frequency: 20, area: 500 },
    ]);
    expect(clusters).toHaveLength(2);
  });

  it('сортує спаданням частоти, tie-break — зростанням hue', () => {
    const clusters = clusterColors([
      { value: '#7c3aed', frequency: 10, area: 100 }, // h≈262
      { value: '#2563eb', frequency: 10, area: 100 }, // h≈221
    ]);
    expect(clusters.map((c) => c.value)).toEqual(['#2563eb', '#7c3aed']);
  });

  it('поріг — іменована константа, а не магічне число', () => {
    expect(CLUSTER_THRESHOLD).toBeGreaterThan(0);
  });
});

describe('lib/contrast.mjs — попередження, не виправлення', () => {
  it('провальна пара потрапляє в contrastWarnings', () => {
    const warnings = checkContrastPairs({
      primary: '221 10% 60%',
      'primary-foreground': '221 10% 70%',
    });
    expect(warnings).toEqual([
      {
        pair: 'primary/primary-foreground',
        ratio: expect.any(Number),
        required: AA_MIN_RATIO,
      },
    ]);
    expect(warnings[0].ratio).toBeLessThan(AA_MIN_RATIO);
  });

  it('прохідна пара — без попереджень', () => {
    const warnings = checkContrastPairs({
      background: '0 0% 100%',
      foreground: '0 0% 0%',
    });
    expect(warnings).toEqual([]);
  });

  it('пара без border/input/ring — контракт їх не визначає', () => {
    const warnings = checkContrastPairs({
      border: '0 0% 50%',
      input: '0 0% 50%',
    });
    expect(warnings).toEqual([]);
  });
});

describe('lib/map.mjs — mapTokens на фікстурному inspection (Р9 ланцюжок-тест)', () => {
  const proposal = mapTokens(sampleInspection);

  it('DoD §3.3: обовʼязкові ключі присутні', () => {
    expect(proposal.tokens.background).toBeDefined();
    expect(proposal.tokens.foreground).toBeDefined();
    expect(proposal.tokens.primary).toBeDefined();
    expect(proposal.tokens['font-sans']).toBeDefined();
  });

  it('форма tokens-proposal відповідає Р4 (schemaVersion/dark-усередині-tokens)', () => {
    expect(proposal.schemaVersion).toBe(1);
    expect(proposal.tokens.dark).toBeTypeOf('object');
    expect(Object.hasOwn(proposal, 'confidence')).toBe(true);
    expect(Object.hasOwn(proposal, 'contrastWarnings')).toBe(true);
    expect(Object.hasOwn(proposal, 'unmapped')).toBe(true);
  });

  it('усі 23 кольорові ключі (світлі й dark) — валідні HSL-трійки, radius/font-* — ні', () => {
    for (const [key, value] of Object.entries(proposal.tokens)) {
      if (NON_COLOR_KEYS.has(key)) continue;
      expect(value, `tokens.${key}`).toMatch(HSL_TRIPLE_REGEX);
    }
    for (const [key, value] of Object.entries(proposal.tokens.dark ?? {})) {
      expect(value, `tokens.dark.${key}`).toMatch(HSL_TRIPLE_REGEX);
    }
  });

  it('radius/font-* — НЕ HSL-трійка (формат-виняток)', () => {
    expect(proposal.tokens.radius).toBe('0.5rem');
    expect(proposal.tokens.radius).not.toMatch(HSL_TRIPLE_REGEX);
    expect(proposal.tokens['font-sans']).not.toMatch(HSL_TRIPLE_REGEX);
  });

  it('fonts — ЛИШЕ з підтвердженням fontStylesheets (Р7)', () => {
    expect(proposal.fonts).toEqual([
      {
        stylesheet:
          'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
      },
      {
        stylesheet:
          'https://fonts.googleapis.com/css2?family=Manrope:wght@700;800&display=swap',
      },
    ]);
  });

  it('unmapped чесно перелічує колір, що нікуди не ліг', () => {
    expect(proposal.unmapped).toEqual(['#fbbf24']);
  });

  it('contrastWarnings ловить провальну dark-пару (не виправляє, лише сигналить)', () => {
    expect(proposal.contrastWarnings.length).toBeGreaterThan(0);
    expect(
      proposal.contrastWarnings.every((w) => w.pair.startsWith('dark:')),
    ).toBe(true);
    expect(proposal.contrastWarnings.every((w) => w.ratio < AA_MIN_RATIO)).toBe(
      true,
    );
  });

  it('Р9(а): applyTokens емить РІВНО одну декларацію на кожен ключ tokens (і на кожен dark-ключ)', () => {
    const css = applyTokens(proposal.tokens);
    expect(css).toMatch(/^:root\s*\{/);
    expect(css).toContain('.dark {');

    // `--background` тощо зʼявляється і в `:root`, і в `.dark` — рахуємо блоки окремо.
    const rootBlock = css.slice(0, css.indexOf('.dark {'));
    const darkBlock = css.slice(css.indexOf('.dark {'));

    for (const key of Object.keys(proposal.tokens)) {
      if (key === 'dark') continue;
      const count = rootBlock.split(`--${key}:`).length - 1;
      expect(count, `:root --${key}`).toBe(1);
    }
    expect(proposal.tokens.dark).toBeDefined();
    for (const key of Object.keys(proposal.tokens.dark ?? {})) {
      const count = darkBlock.split(`--${key}:`).length - 1;
      expect(count, `.dark --${key}`).toBe(1);
    }
  });

  it('Р9: пропозиція проходить validateThemeModule у скаффолді теми', () => {
    const themeModule = {
      manifest: {
        name: 'redesign-demo',
        displayName: 'Redesign Demo',
        version: '0.1.0',
        engines: { simplycms: '>=0.1.0' },
      },
      tokens: proposal.tokens,
      components: { Header: () => null, Footer: () => null },
      ...(proposal.fonts ? { fonts: proposal.fonts } : {}),
    };

    expect(() => validateThemeModule(themeModule)).not.toThrow();
  });
});
