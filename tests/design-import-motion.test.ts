/**
 * Смок motion-капчера в headless chromium (інкремент Б.2, Фаза 1, план
 * Р1/Р4/Р6): `inspectPage` на `tests/fixtures/design-import/motion.html` дає
 * `schemaVersion: 2` і секцію `motion` з усіма чотирма каналами.
 *
 * Окремий файл, а не доважок до `design-import-inspect.test.ts` (той уже 220+
 * рядків при каноні ≤150) — і скоуп інший: там колірний контракт, тут рух.
 * Патерн browser-гейту скопійовано звідти: TOP-LEVEL AWAIT + реальний
 * launch-probe, бо async-функція всередині `skipIf` повертає Promise (завжди
 * truthy) і дала б вічний skip, якого TS не ловить.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { afterAll, describe, expect, it } from 'vitest';
import { resolveChromium } from '../.agents/skills/redesign-from-reference/scripts/lib/browser.mjs';
import { sweepHover } from '../.agents/skills/redesign-from-reference/scripts/lib/hover-sweep.mjs';
import { inspectPage } from '../.agents/skills/redesign-from-reference/scripts/inspect.mjs';

interface TransitionCluster {
  property: string;
  durationMs: number;
  easing: string;
  count: number;
}

interface RevealEntry {
  index: number;
  selector: string;
  animated: boolean;
  opacityBefore: number;
  opacityAfter: number;
  transformChanged: boolean;
}

interface HoverChange {
  property: string;
  from: string;
  to: string;
}

interface HoverSweep {
  entries: { index: number; selector: string; changes: HoverChange[] }[];
  skipped: number;
}

interface MotionInspection {
  schemaVersion: number;
  motion: {
    transitions: TransitionCluster[];
    keyframes: { names: string[]; inaccessibleSheets: number };
    reveal: RevealEntry[];
    hover: HoverSweep;
    jsLibraries: { detected: string[]; markers: string[] };
    jsDrivenSuspected: boolean;
  };
}

const FIXTURE = readFileSync(
  join(process.cwd(), 'tests/fixtures/design-import/motion.html'),
  'utf8',
);

let browser: import('@playwright/test').Browser | null = null;
let skipReason = '';
try {
  const launchOptions = resolveChromium(chromium);
  browser = await chromium.launch({ headless: true, ...launchOptions });
} catch (error) {
  skipReason = error instanceof Error ? error.message : String(error);
}

afterAll(async () => {
  await browser?.close();
});

/** Прогін `inspectPage` по motion-фікстурі в одноразовій tmp-теці. */
async function inspectFixture(): Promise<MotionInspection> {
  const outDir = mkdtempSync(join(tmpdir(), 'design-import-motion-'));
  try {
    const page = await browser!.newPage();
    // `domcontentloaded` — інакше setContent чекав би недосяжний CDN-скрипт.
    await page.setContent(FIXTURE, { waitUntil: 'domcontentloaded' });
    const inspection = (await inspectPage(page, {
      url: 'https://motion.example/',
      out: outDir,
      dark: false,
    })) as unknown as MotionInspection;
    await page.close();
    return inspection;
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

describe.skipIf(!browser)(
  browser
    ? 'inspect.mjs — motion-капчер у headless chromium'
    : `inspect.mjs motion — SKIP: ${skipReason}`,
  () => {
    it('чотири канали motion + schemaVersion 2', async () => {
      const { schemaVersion, motion } = await inspectFixture();
      expect(schemaVersion).toBe(2);

      // 1. transitions: cubic-bezier із комами всередині дужок не порізаний,
      // багатозначний shorthand розкладений попарно.
      const key = (t: TransitionCluster) =>
        `${t.property}|${t.durationMs}|${t.easing}`;
      const keys = motion.transitions.map(key);
      expect(keys).toContain('opacity|600|cubic-bezier(0.4, 0, 0.2, 1)');
      expect(keys).toContain('transform|600|cubic-bezier(0.4, 0, 0.2, 1)');
      expect(keys).toContain('background-color|150|ease-in-out');
      expect(keys).toContain('box-shadow|300|ease');
      expect(keys).toContain('transform|300|ease');
      // `transition: none` і нульова тривалість — відкинуті.
      expect(keys.some((k) => k.startsWith('none|'))).toBe(false);
      expect(keys).not.toContain('color|0|linear');
      expect(motion.transitions.every((t) => t.durationMs > 0)).toBe(true);
      // Стабільне сортування: count↓ — монотонно незростаючий.
      const counts = motion.transitions.map((t) => t.count);
      expect([...counts].sort((a, b) => b - a)).toEqual(counts);

      // 2. keyframes: зокрема вкладені в @media (рекурсивний обхід CSSOM).
      expect(motion.keyframes.names).toEqual([
        'fade-in-up',
        'nested-spin',
        'pulse-badge',
      ]);
      expect(motion.keyframes.inaccessibleSheets).toBe(0);

      // 3. reveal: обидві `.reveal`-секції проявились, статичні — ні.
      const animated = motion.reveal.filter((r) => r.animated);
      expect(animated).toHaveLength(2);
      expect(animated.every((r) => r.selector === 'section.reveal')).toBe(true);
      expect(animated.every((r) => r.opacityBefore === 0)).toBe(true);
      expect(animated.every((r) => r.opacityAfter === 1)).toBe(true);
      expect(animated.every((r) => r.transformChanged)).toBe(true);
      expect(motion.reveal.some((r) => r.selector === 'section.hero')).toBe(
        true,
      );
      expect(
        motion.reveal.find((r) => r.selector === 'section.hero')?.animated,
      ).toBe(false);
      expect(motion.reveal.map((r) => r.index)).toEqual(
        [...motion.reveal.map((r) => r.index)].sort((a, b) => a - b),
      );

      // 4. jsLibraries: усі три канали детекції разом.
      expect(motion.jsLibraries.detected).toEqual(['framer-motion', 'gsap']);
      expect(motion.jsLibraries.markers).toContain('global:gsap');
      expect(motion.jsLibraries.markers).toContain(
        'data:data-framer-appear-id',
      );
      expect(
        motion.jsLibraries.markers.some((m) => m.startsWith('script:')),
      ).toBe(true);

      // reveal пояснюється CSS-transition по opacity/transform — не JS.
      expect(motion.jsDrivenSuspected).toBe(false);
    }, 120_000);

    // Р5: hover-канал. Дельта є рівно там, де є `:hover`-правило; сусіднє
    // посилання без нього у виводі відсутнє (а не присутнє з порожнім changes).
    it('hover-дельта — лише там, де є :hover-правило', async () => {
      const { motion } = await inspectFixture();
      const bySelector = new Map(
        motion.hover.entries.map((entry) => [entry.selector, entry]),
      );

      // Сортування за селектором+індексом — детерміноване й абеткове.
      expect([...bySelector.keys()]).toEqual([
        'a.nav-link',
        'button.cta',
        'span.ghost',
      ]);
      expect(bySelector.has('a.nav-plain')).toBe(false);
      expect(motion.hover.skipped).toBe(0);

      const properties = (selector: string) =>
        bySelector.get(selector)?.changes.map((c) => c.property);
      // `border-color` за замовчуванням — `currentColor`, тож зміна `color`
      // тягне за собою і його (навіть при `border-style: none`). Це не шум
      // капчера, а реальний computed-стан: фіксуємо як є.
      expect(properties('a.nav-link')).toEqual(['border-color', 'color']);
      expect(properties('button.cta')).toEqual([
        'background-color',
        'transform',
      ]);
      expect(properties('span.ghost')).toEqual(['border-color', 'box-shadow']);

      // Значення — саме кінцеві, а не середина переходу (settle-пауза).
      const cta = bySelector.get('button.cta')!.changes;
      expect(cta[0]).toMatchObject({
        from: 'rgb(37, 99, 235)',
        to: 'rgb(29, 78, 216)',
      });
      expect(cta[1].from).toBe('none');
      expect(cta[1].to).toMatch(/^matrix\(/);
    }, 120_000);

    // Стеля відбору — саме стеля, а не «скільки є».
    it('sweepHover поважає ліміт кандидатів', async () => {
      const page = await browser!.newPage();
      try {
        await page.setContent(FIXTURE, { waitUntil: 'domcontentloaded' });
        const all = (await sweepHover(page, { settleMs: 250 })) as HoverSweep;
        const capped = (await sweepHover(page, {
          limit: 1,
          settleMs: 250,
        })) as HoverSweep;

        expect(all.entries).toHaveLength(3);
        expect(capped.entries).toHaveLength(1);
        // Перший кандидат у DOM-порядку — посилання шапки, а не кнопка.
        expect(capped.entries[0].selector).toBe('a.nav-link');
        expect(capped.skipped).toBe(0);
      } finally {
        await page.close();
      }
    }, 60_000);

    it('два прогони на тій самій сторінці дають ідентичні transitions, keyframes і hover', async () => {
      const first = await inspectFixture();
      const second = await inspectFixture();
      expect(second.motion.transitions).toEqual(first.motion.transitions);
      expect(second.motion.keyframes).toEqual(first.motion.keyframes);
      expect(second.motion.hover).toEqual(first.motion.hover);
    }, 180_000);

    // Р1: cross-origin аркуш — НЕ мовчазний дроп. Відповідь підмінює
    // `page.route`, тож мережа не потрібна: сам факт іншого походження вже
    // закриває `.cssRules` для CSSOM.
    it('cross-origin stylesheet рахується в inaccessibleSheets', async () => {
      const page = await browser!.newPage();
      const outDir = mkdtempSync(join(tmpdir(), 'design-import-xorigin-'));
      try {
        await page.route('https://cdn.example.test/**', (route) =>
          route.fulfill({
            contentType: 'text/css',
            body: '@keyframes hidden-spin { from { opacity: 0 } to { opacity: 1 } }',
          }),
        );
        await page.setContent(
          '<link rel="stylesheet" href="https://cdn.example.test/x.css">' +
            '<main><section>cross-origin</section></main>',
          { waitUntil: 'load' },
        );
        const inspection = (await inspectPage(page, {
          url: 'https://xorigin.example/',
          out: outDir,
          dark: false,
        })) as unknown as MotionInspection;

        expect(inspection.motion.keyframes.inaccessibleSheets).toBeGreaterThan(
          0,
        );
        expect(inspection.motion.keyframes.names).not.toContain('hidden-spin');
      } finally {
        await page.close();
        rmSync(outDir, { recursive: true, force: true });
      }
    }, 120_000);
  },
);
