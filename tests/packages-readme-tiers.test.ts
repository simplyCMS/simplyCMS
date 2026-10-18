// Таблиця тірів `packages/README.md` — канон «тіри й напрям імпортів» за AGENTS.md — і код
// (`eslint.tier-zones.mjs`) двічі розходились мовчки: README не знав винятку
// `storefront→translations` і нових upward `admin-server`. Тут вони звіряються рядок у рядок:
// тека, шар і колонка «Upward-винятки» = зона (теки upward + файли-винятки). Прозою upward
// в описі не пишемо: другий носій того самого переліку знову розійшовся б.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TIER_ZONES } from '../eslint.tier-zones.mjs';

type Zone = [string, number, string | null, string[], string[]?, string[]?];

interface Row {
  readonly tier: number;
  readonly upward: readonly string[];
  readonly description: string;
}

const README = resolve(__dirname, '../packages/README.md');

/** Рядки таблиць тірів: `| \`тека/\` | вхід | Tn | upward | опис |`, тека → ключ зони. */
function parseTierRows(text: string): Map<string, Row> {
  const rows = new Map<string, Row>();
  for (const line of text.split('\n')) {
    const m = /^\| `((?:routes\/)?[a-z0-9-]+)\/` \|/.exec(line);
    if (!m) continue;
    const cells = line
      .slice(1, -1)
      .split(' | ')
      .map((c) => c.trim());
    const tier = /^T(\d)$/.exec(cells[2] ?? '');
    if (!tier) continue;
    const key = m[1]!.startsWith('routes/') ? m[1]! : `src/${m[1]}`;
    const upward =
      cells[3] === '—'
        ? []
        : (cells[3] ?? '').split(', ').map((c) => c.replace(/^`|`$/g, ''));
    rows.set(key, {
      tier: Number(tier[1]),
      upward,
      description: cells.slice(4).join(' | '),
    });
  }
  return rows;
}

const zones = () =>
  new Map(
    (TIER_ZONES as Zone[]).map(([dir, tier, , upward, , files = []]) => [
      dir,
      { tier, upward: [...upward, ...files] },
    ]),
  );

describe('packages/README.md ↔ eslint.tier-zones.mjs', () => {
  const rows = parseTierRows(readFileSync(README, 'utf8'));

  it('кожна зона має рядок у таблиці і навпаки', () => {
    expect([...rows.keys()].sort()).toEqual([...zones().keys()].sort());
  });

  it('шар і upward-винятки рядка = зона', () => {
    const drift: string[] = [];
    for (const [dir, zone] of zones()) {
      const row = rows.get(dir);
      if (!row) continue;
      if (row.tier !== zone.tier)
        drift.push(`${dir}: T${row.tier} ≠ T${zone.tier}`);
      if ([...row.upward].sort().join() !== [...zone.upward].sort().join())
        drift.push(
          `${dir}: README [${row.upward.join(', ')}] ≠ зона [${zone.upward.join(', ')}]`,
        );
    }
    expect(drift).toEqual([]);
  });

  it('опис не дублює upward прозою (перелік — лише в колонці)', () => {
    const prose = [...rows]
      .filter(([, r]) => /upward/i.test(r.description))
      .map(([dir]) => dir);
    expect(prose).toEqual([]);
  });

  it('негативний контроль: розбіжність колонки з зоною видно', () => {
    const text = readFileSync(README, 'utf8').replace(
      /(\| `storefront\/` \| `simplycms\/storefront` \| T2 \| [^|]*?), `translations` \|/,
      '$1 |',
    );
    expect(parseTierRows(text).get('src/storefront')?.upward).not.toContain(
      'translations',
    );
    expect(rows.get('src/storefront')?.upward).toContain('translations');
  });
});
