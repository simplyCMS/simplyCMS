/**
 * Юніти структурованого `unmapped` (інкремент Б.3, Фаза 4, план Р7 / знахідки
 * V-6 + V-7): `lib/unmapped.mjs` напряму і наскрізно через `mapColorTokens`.
 * Браузера не потребує принципово — це чиста арифметика над кластерами.
 *
 * До Б.3 `unmapped` був масивом рядків, тож провал контрасту немапованого
 * тексту (`#6a7282` на полотні `#f5f5f5` — 4.44 при AA 4.5) не бачив ніхто:
 * `contrastWarnings` дивиться ЛИШЕ на змаповані пари. Саме цей кейс і є
 * головним асертом файлу.
 */
import { describe, expect, it } from 'vitest';
import { clusterColors } from '../.agents/skills/redesign-from-reference/scripts/lib/cluster.mjs';
import { mapColorTokens } from '../.agents/skills/redesign-from-reference/scripts/lib/color-tokens.mjs';
import { collectUnmapped } from '../.agents/skills/redesign-from-reference/scripts/lib/unmapped.mjs';

interface UnmappedEntry {
  hex: string;
  role: string;
  count: number;
  area: number;
  contrastOnBackground: number | null;
  contrastOnCard: number | null;
  belowAA: boolean;
}

/** Кластери однієї ролі з сирих семплів — той самий шлях, що й у мапінгу. */
function clusters(
  samples: { value: string; frequency: number; area?: number }[],
) {
  return clusterColors(samples);
}

describe('lib/unmapped.mjs — collectUnmapped (Р7)', () => {
  const tokens = { background: '0 0% 96%', card: '0 0% 100%' };

  it('DoD: #6a7282 на #f5f5f5 → belowAA (4.44 < 4.5), хоча на картці проходить', () => {
    const [entry] = collectUnmapped(
      { text: clusters([{ value: '#6a7282', frequency: 30, area: 900 }]) },
      new Set(),
      tokens,
    ) as UnmappedEntry[];

    expect(entry.hex).toBe('#6a7282');
    expect(entry.role).toBe('text');
    expect(entry.count).toBe(30);
    expect(entry.area).toBe(900);
    expect(entry.contrastOnBackground).toBe(4.44);
    // 🔴 На білій картці той самий колір проходить (4.84) — прапорець
    // піднімається за НАЙГІРШОЮ поверхнею, інакше провал на полотні лишався б
    // тихим рівно так само, як до Б.3.
    expect(entry.contrastOnCard).toBe(4.84);
    expect(entry.belowAA).toBe(true);
  });

  it('провал лише на картці теж піднімає прапорець', () => {
    const [entry] = collectUnmapped(
      { text: clusters([{ value: '#757575', frequency: 10 }]) },
      new Set(),
      { background: '0 0% 100%', card: '0 0% 63%' },
    ) as UnmappedEntry[];

    expect(entry.contrastOnBackground).toBe(4.61); // на полотні — прохідний
    expect(entry.contrastOnCard).toBe(1.78);
    expect(entry.belowAA).toBe(true);
  });

  // 🔴 Роль вирішує: контраст ФОНОВОГО кольору «на фоні» ≈1 за визначенням, і
  // без цього обмеження прапорець стояв би на кожному фоні й не означав нічого.
  it('не-текстові ролі прапорця не отримують, але контрасти показують', () => {
    const entries = collectUnmapped(
      {
        background: clusters([{ value: '#fbbf24', frequency: 5, area: 400 }]),
        border: clusters([{ value: '#e4e4e7', frequency: 4 }]),
      },
      new Set(),
      tokens,
    ) as UnmappedEntry[];

    expect(entries.every((e) => e.belowAA)).toBe(false);
    expect(entries.every((e) => e.contrastOnBackground !== null)).toBe(true);
    expect(entries.map((e) => e.role)).toEqual(['background', 'border']);
  });

  it('токена немає → null, а не 0 (нуль читався б як виміряний провал)', () => {
    const [entry] = collectUnmapped(
      { text: clusters([{ value: '#6a7282', frequency: 3 }]) },
      new Set(),
      {},
    ) as UnmappedEntry[];

    expect(entry.contrastOnBackground).toBeNull();
    expect(entry.contrastOnCard).toBeNull();
    // Міряти не було проти чого — прапорець не піднімається на порожньому місці.
    expect(entry.belowAA).toBe(false);
  });

  // 🔴 Канал < 16 у hex — це рівно один нуль, який легко загубити (`rgbToHex`
  // без `padStart`). Наслідок подвійний: людина читає у звіті ІНШИЙ колір, а
  // ключ дедупу (`hex|role`) схлопує різні кольори в один запис.
  it('канал < 16 не зʼїдає провідний нуль: zinc-950 лишається #09090b', () => {
    const [entry] = collectUnmapped(
      { text: clusters([{ value: 'rgb(9, 9, 11)', frequency: 12 }]) },
      new Set(),
      tokens,
    ) as UnmappedEntry[];

    expect(entry.hex).toBe('#09090b'); // без padStart було б «#99b»
  });

  it('два різні кольори з малими каналами лишаються двома записами', () => {
    // Без `padStart` обидва дають «#1234» — і різні факти про сторінку
    // зливаються в один рядок звіту з підсумованою частотою.
    const entries = collectUnmapped(
      {
        text: [
          ...clusters([{ value: 'rgb(1, 2, 52)', frequency: 9 }]),
          ...clusters([{ value: 'rgb(18, 3, 4)', frequency: 7 }]),
        ],
      },
      new Set(),
      tokens,
    ) as UnmappedEntry[];

    expect(entries.map((e) => e.hex)).toEqual(['#010234', '#120304']);
    expect(entries.map((e) => e.count)).toEqual([9, 7]);
  });

  it('витрачені кластери у звіт не потрапляють (дедуп із мапінгом за посиланням)', () => {
    const bg = clusters([{ value: '#ffffff', frequency: 100 }]);
    expect(
      collectUnmapped({ background: bg }, new Set(bg), tokens),
    ).toHaveLength(0);
  });

  it('той самий hex у різних ролях — два записи; сортування count↓, далі hex', () => {
    const entries = collectUnmapped(
      {
        background: clusters([{ value: '#111111', frequency: 30 }]),
        text: clusters([
          { value: '#111111', frequency: 80 },
          { value: '#6a7282', frequency: 80 },
        ]),
      },
      new Set(),
      tokens,
    ) as UnmappedEntry[];

    expect(entries.map((e) => [e.hex, e.role, e.count])).toEqual([
      // Однакова частота 80 — тайбрейк за hex; роль розрізняє записи, бо
      // саме від неї залежить `belowAA`.
      ['#111111', 'text', 80],
      ['#6a7282', 'text', 80],
      ['#111111', 'background', 30],
    ]);
  });

  it('різні сирі рядки однієї ролі — один запис із сумарною частотою', () => {
    // `rgb(17, 17, 17)` і `#111111` — той самий колір; кластеризація зводить
    // їх в один кластер, а hex-нормалізація гарантує спільний ключ навіть
    // якби кластери розійшлись.
    const entries = collectUnmapped(
      {
        text: [
          ...clusters([{ value: '#111111', frequency: 40, area: 100 }]),
          ...clusters([{ value: 'rgb(17, 17, 17)', frequency: 20, area: 50 }]),
        ],
      },
      new Set(),
      tokens,
    ) as UnmappedEntry[];

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ hex: '#111111', count: 60, area: 150 });
  });
});

describe('lib/color-tokens.mjs — unmapped наскрізно (V-6 + V-7)', () => {
  it('немапований текст із провальним контрастом видно в пропозиції', () => {
    const { tokens, unmapped } = mapColorTokens([
      { role: 'background', value: '#f5f5f5', frequency: 100, area: 900000 },
      { role: 'text', value: '#111111', frequency: 80, area: 40000 },
      { role: 'text', value: '#6a7282', frequency: 30, area: 9000 },
    ]) as { tokens: Record<string, string>; unmapped: UnmappedEntry[] };

    expect(tokens.background).toBe('0 0% 96%');
    expect(tokens.foreground).toBe('0 0% 7%');
    // Картки в семплі немає — поле чесно `null`, а не вигаданий нуль.
    expect(tokens.card).toBeUndefined();
    expect(unmapped).toEqual([
      {
        hex: '#6a7282',
        role: 'text',
        count: 30,
        area: 9000,
        contrastOnBackground: 4.44,
        contrastOnCard: null,
        belowAA: true,
      },
    ]);
  });
});
