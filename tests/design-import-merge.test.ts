/**
 * Юніти `lib/merge.mjs — mergeInspections` (задача §2.D, план Р6, Фаза 4
 * Step 2): злиті частоти/OR-interactive, голосування шрифтів з tie-break,
 * union `fontStylesheets`, OR `darkDetected`, і — окремим блоком — інваріант
 * «перестановка вхідних файлів дає той самий результат» (Р6).
 */
import { describe, expect, it } from 'vitest';
import { mergeInspections } from '../.agents/skills/redesign-from-reference/scripts/lib/merge.mjs';

/** Мінімальна валідна `inspection`-подібна фікстура для тестів злиття. */
function page(overrides = {}) {
  return {
    schemaVersion: 1,
    url: 'https://example.test/',
    colors: [],
    radius: [],
    fonts: { heading: null, body: null },
    fontStylesheets: [],
    darkDetected: false,
    ...overrides,
  };
}

describe('lib/merge.mjs — mergeInspections', () => {
  it('кольори: частоти й area сумуються по (role,value), interactive — OR', () => {
    const a = page({
      colors: [
        {
          role: 'background',
          value: '#fff',
          frequency: 10,
          area: 100,
          interactive: false,
        },
      ],
    });
    const b = page({
      colors: [
        {
          role: 'background',
          value: '#fff',
          frequency: 5,
          area: 50,
          interactive: true,
        },
      ],
    });

    const merged = mergeInspections([a, b]);
    expect(merged.colors).toEqual([
      {
        role: 'background',
        value: '#fff',
        frequency: 15,
        area: 150,
        interactive: true,
      },
    ]);
  });

  it('шрифти: більшість голосів перемагає', () => {
    const a = page({ fonts: { heading: { family: 'Inter' }, body: null } });
    const b = page({ fonts: { heading: { family: 'Inter' }, body: null } });
    const c = page({ fonts: { heading: { family: 'Manrope' }, body: null } });

    const merged = mergeInspections([a, b, c]);
    expect(merged.fonts.heading?.family).toBe('Inter');
  });

  it('шрифти: нічия по голосах — вирішує сторінка з більшою сумою колірних частот', () => {
    const low = page({
      colors: [{ role: 'background', value: '#fff', frequency: 100 }],
      fonts: { heading: { family: 'Inter' }, body: null },
    });
    const high = page({
      colors: [{ role: 'background', value: '#000', frequency: 200 }],
      fonts: { heading: { family: 'Manrope' }, body: null },
    });

    const merged = mergeInspections([low, high]);
    expect(merged.fonts.heading?.family).toBe('Manrope');
  });

  it('шрифти: подвійна нічия (голоси й сума частот) — лексикографічний tie-break', () => {
    const zeta = page({
      colors: [{ role: 'background', value: '#fff', frequency: 100 }],
      fonts: { heading: { family: 'Zeta' }, body: null },
    });
    const alpha = page({
      colors: [{ role: 'background', value: '#000', frequency: 100 }],
      fonts: { heading: { family: 'Alpha' }, body: null },
    });

    const merged = mergeInspections([zeta, alpha]);
    expect(merged.fonts.heading?.family).toBe('Alpha');
  });

  it('без шрифту на жодній сторінці — null, а не крах', () => {
    const merged = mergeInspections([page(), page()]);
    expect(merged.fonts.heading).toBeNull();
    expect(merged.fonts.body).toBeNull();
  });

  it('fontStylesheets — union, дедуп і сортування', () => {
    const a = page({ fontStylesheets: ['https://fonts.example/b.css'] });
    const b = page({
      fontStylesheets: [
        'https://fonts.example/a.css',
        'https://fonts.example/b.css',
      ],
    });

    const merged = mergeInspections([a, b]);
    expect(merged.fontStylesheets).toEqual([
      'https://fonts.example/a.css',
      'https://fonts.example/b.css',
    ]);
  });

  it('darkDetected — OR; dark-кольори зливаються лише зі сторінок, де dark виявлено', () => {
    const withDark = page({
      darkDetected: true,
      dark: { colors: [{ role: 'background', value: '#111', frequency: 9 }] },
    });
    const withoutDark = page({ darkDetected: false });

    const merged = mergeInspections([withDark, withoutDark]);
    expect(merged.darkDetected).toBe(true);
    expect(merged.dark?.colors).toEqual([
      {
        role: 'background',
        value: '#111',
        frequency: 9,
        area: 0,
        interactive: false,
      },
    ]);
  });

  it('жодна сторінка без dark — `dark` відсутній у виводі', () => {
    const merged = mergeInspections([page(), page()]);
    expect(merged).not.toHaveProperty('dark');
  });

  it('radius — конкатенація (без сумування по valuePx), довжина = сума входів', () => {
    const a = page({ radius: [{ valuePx: 8, frequency: 5 }] });
    const b = page({
      radius: [
        { valuePx: 4, frequency: 3 },
        { valuePx: 8, frequency: 2 },
      ],
    });

    const merged = mergeInspections([a, b]);
    expect(merged.radius).toHaveLength(3);
    expect(merged.radius.map((r: { valuePx: number }) => r.valuePx)).toEqual([
      4, 8, 8,
    ]);
  });

  // 🔴 Р3: `motion` — пер-сторінкова секція за природою (тривалості, reveal і
  // hover описують КОНКРЕТНУ сторінку, і спека компонента читає саме її
  // `inspection.json`). Усереднення по сторінках дало б число, якого немає в
  // жодній із них, тож `mergeInspections` motion не зливає ВЗАГАЛІ — і в
  // зведеному виводі ключа немає. Цей тест стереже саме навмисність.
  it('зведення N>1 НЕ містить ключа motion (Р3 — motion пер-сторінковий)', () => {
    const withMotion = (property: string) =>
      page({
        schemaVersion: 2,
        motion: {
          transitions: [
            { property, durationMs: 300, easing: 'ease', count: 4 },
          ],
          keyframes: { names: ['fade-in'], inaccessibleSheets: 0 },
          reveal: [{ index: 0, animated: true }],
          jsLibraries: { detected: ['gsap'], markers: ['global:gsap'] },
          jsDrivenSuspected: false,
        },
      });

    const merged = mergeInspections([
      withMotion('opacity'),
      withMotion('transform'),
    ]);
    expect(merged).not.toHaveProperty('motion');
  });

  it('перестановка вхідних файлів дає той самий результат (Р6)', () => {
    const a = page({
      url: 'https://example.test/a',
      colors: [
        { role: 'background', value: '#fff', frequency: 10, area: 100 },
        { role: 'text', value: '#111', frequency: 7, area: 40 },
      ],
      fonts: { heading: { family: 'Inter' }, body: { family: 'Inter' } },
      fontStylesheets: ['https://fonts.example/inter.css'],
    });
    const b = page({
      url: 'https://example.test/b',
      colors: [
        { role: 'background', value: '#fff', frequency: 5, area: 50 },
        { role: 'background', value: '#2563eb', frequency: 3, area: 20 },
      ],
      fonts: { heading: { family: 'Manrope' }, body: { family: 'Inter' } },
      fontStylesheets: ['https://fonts.example/manrope.css'],
    });
    const c = page({
      url: 'https://example.test/c',
      colors: [{ role: 'border', value: '#e4e4e7', frequency: 2, area: 10 }],
      darkDetected: true,
      dark: { colors: [{ role: 'background', value: '#000', frequency: 1 }] },
    });

    const orderings = [
      [a, b, c],
      [c, a, b],
      [b, c, a],
    ];
    const results = orderings.map((order) => mergeInspections(order));

    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
  });
});
