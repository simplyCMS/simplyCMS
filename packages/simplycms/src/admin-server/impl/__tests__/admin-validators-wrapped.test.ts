// Тема 12: механізм конвертації Zod → ValidationError живе у валідаторі, тож
// його слід застосувати до КОЖНОГО serverFn адмінки. Голий `.validator(schema)`
// мовчки повернув би сирий JSON у тост (Start кидає
// `Error(JSON.stringify(issues))` для будь-якої Standard-схеми) — гейт тут.
import { describe, expect, it } from 'vitest';

const source = Object.values(
  import.meta.glob('../../index.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
).join('\n') as string;

/** Усі аргументи `.validator(...)` — до відповідної `)` на рівні дужок. */
function validatorArgs(src: string): string[] {
  const out: string[] = [];
  const re = /\.validator\(/g;
  while (re.exec(src)) {
    let depth = 1;
    let i = re.lastIndex;
    while (depth > 0 && i < src.length) {
      if (src[i] === '(') depth++;
      else if (src[i] === ')') depth--;
      i++;
    }
    out.push(src.slice(re.lastIndex, i - 1).trim());
  }
  return out;
}

describe('admin-server/index.ts: валідатори serverFn', () => {
  const args = validatorArgs(source);

  it('знайдено валідатори (гейт не порожній)', () => {
    expect(args.length).toBeGreaterThan(50);
  });

  it('кожен — adminInput(...) або функція над FormData (не Zod-схема)', () => {
    const bare = args.filter(
      (a) => !a.startsWith('adminInput(') && !/FormData/.test(a),
    );
    expect(bare).toEqual([]);
  });

  it('єдиний виняток — завантаження (FormData), а не схема', () => {
    const exceptions = args.filter((a) => !a.startsWith('adminInput('));
    expect(exceptions).toHaveLength(1);
  });
});
