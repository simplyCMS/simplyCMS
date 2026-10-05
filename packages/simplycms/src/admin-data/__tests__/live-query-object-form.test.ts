import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * Ратчет: `useLiveQuery` лише в обʼєктній формі `{ query }`, а
 * `useLiveInfiniteQuery` — без третього аргументу `deps`. Масив залежностей
 * задепрекований бібліотекою (react-db 0.5.3, зникне в 1.0): змінні із
 * замикання запиту (orderId, фільтри) потрапляють в IR і дають виведену
 * ідентичність, deps для цього не потрібні. Сканер — не регулярка по одному
 * рядку, а розбір аргументів виклику (багаторядкові виклики з deps).
 */
const SRC = resolve(import.meta.dirname, '../..');
const CALL = /\b(useLiveQuery|useLiveInfiniteQuery)\s*\(/g;

/** Прибирає коментарі, щоб згадки хука в докблоках не рахувались. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

/** Аргументи виклику, що починається одразу після `(` у позиції `from`. */
function topLevelArgs(src: string, from: number): string[] {
  const args: string[] = [];
  let depth = 0;
  let start = from;
  for (let i = from; i < src.length; i++) {
    const ch = src[i];
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) {
      if (depth === 0) {
        const last = src.slice(start, i).trim();
        if (last) args.push(last);
        return args;
      }
      depth--;
    } else if (ch === ',' && depth === 0) {
      args.push(src.slice(start, i).trim());
      start = i + 1;
    }
  }
  return args;
}

/** Виклики у старій формі: `fn`/builder першим аргументом або зайві deps. */
export function findLegacyCalls(source: string): string[] {
  const src = stripComments(source);
  const found: string[] = [];
  for (const m of src.matchAll(CALL)) {
    const args = topLevelArgs(src, m.index + m[0].length);
    const legacy =
      m[1] === 'useLiveQuery'
        ? args.length >= 2 || !args[0]?.startsWith('{')
        : args.length >= 3;
    if (legacy) found.push(`${m[1]}(${args[0]?.slice(0, 40) ?? ''}…`);
  }
  return found;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '__tests__' || e.name === 'node_modules') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
  }
  return out;
}

describe('useLiveQuery: обʼєктна форма', () => {
  it('сканер ловить стару форму (негативний контроль)', () => {
    expect(findLegacyCalls('useLiveQuery((q) => q.from({ a }))')).toHaveLength(
      1,
    );
    expect(
      findLegacyCalls('useLiveQuery(\n (q) => q.from({ a }),\n [id],\n)'),
    ).toHaveLength(1);
    expect(
      findLegacyCalls('useLiveQuery({ query: (q) => q.from({ a }) }, [id])'),
    ).toHaveLength(1);
    expect(
      findLegacyCalls('useLiveInfiniteQuery((q) => x, { pageSize: 1 }, [a])'),
    ).toHaveLength(1);
    expect(
      findLegacyCalls('useLiveQuery({ query: (q) => q.from({ a }) })'),
    ).toEqual([]);
    expect(
      findLegacyCalls('useLiveInfiniteQuery((q) => x, { pageSize: 1 })'),
    ).toEqual([]);
    expect(findLegacyCalls('// useLiveQuery((q) => x)')).toEqual([]);
  });

  it('у packages/simplycms/src немає викликів у задепрекованій формі', () => {
    const offenders = walk(SRC).flatMap((file) =>
      findLegacyCalls(readFileSync(file, 'utf8')).map(
        (c) => `${relative(SRC, file)}: ${c}`,
      ),
    );
    expect(offenders).toEqual([]);
  });
});
