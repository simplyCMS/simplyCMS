import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { DIR, ROOT, walk } from './scan';

/**
 * Структурний гард «читання БД після очікування зникнення рядка» (без ліміту
 * рядків і без прив'язки до форми аргументів).
 *
 * Видалення в адмінці оптимістичне (`collection.delete`): рядок зникає з UI ДО
 * COMMIT, тож `waitFor({ state: 'detached' })` / `expectGone(...)` не доводять,
 * що БД уже змінилась. Будь-яке читання БД після такого очікування в тій самій
 * функції верхнього рівня мусить іти через `pollUntil(...)`.
 *
 * Як визначається «читання БД» (по ВСІХ файлах смоку):
 *  • `sql(` — базове читання (`sql.mjs`);
 *  • «читач» — іменована функція/стрілка (де завгодно, зокрема вкладена), у тілі
 *    якої є `sql(` або виклик іншого читача (ТРАНЗИТИВНО) і немає `page`;
 *  • «очікувач» — іменована функція, у тілі якої ПРЯМО є `state: 'detached'` /
 *    `expectGone(`; її виклик теж є точкою очікування.
 * Порушення: у функції верхнього рівня після точки очікування є виклик
 * читача/`sql(` поза аргументами `pollUntil(...)`.
 *
 * 🔴 Два свідомі обмеження (вмикаються назад режимом `strict`):
 *  (а) очікувачі НЕ транзитивні: функція, що лише викликає очікувача
 *      (`del → step(del) → top: step(); q()`), очікувачем не вважається. Інакше
 *      кожен оркестратор, що десь глибоко викликає очікування, робив би
 *      підозрілим будь-яке своє читання після нього — шум без користі: після
 *      вкладеного кроку читання зазвичай стосується іншого стану.
 *  (б) функція з `page` читачем не вважається: крок із браузером, що читає БД
 *      всередині, — це сценарій, а не читач; без цього кожен крок-оркестратор
 *      ставав би «читачем» через свої виклики читачів.
 * Перевірено: у режимі `strict` (транзитивні очікувачі + читачі з `page`)
 * реальних прихованих випадків понад виїмки немає — див. звіт Task 12.
 */

type Fn = { name: string; start: number; end: number; top: boolean };
type Src = { file: string; text: string; masked: string; fns: Fn[] };

/** Коментарі → пробіли (довжина й позиції збережені). */
function blankComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(
      /(^|[^:])\/\/.*$/gm,
      (m, p: string) => p + ' '.repeat(m.length - p.length),
    );
}

/** Заміна вмісту рядкових літералів пробілами: дужки в рядках не збивають розбір. */
function maskStrings(src: string): string {
  let out = '';
  for (let i = 0; i < src.length;) {
    const c = src[i]!;
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === '\\' ? 2 : 1;
      out += c + src.slice(i + 1, j).replace(/[^\n]/g, ' ') + c;
      i = j + 1;
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
}

/** Індекс закриваючої дужки до відкриваючої на `open`. */
function matchClose(t: string, open: number): number {
  const pairs: Record<string, string> = { '(': ')', '{': '}', '[': ']' };
  let depth = 0;
  for (let i = open; i < t.length; i++) {
    if ('({['.includes(t[i]!)) depth += 1;
    else if (')}]'.includes(t[i]!) && --depth === 0) return i;
  }
  void pairs;
  return t.length;
}

/** Кінець ініціалізатора `const x = …;` — до `;` на нульовій глибині. */
function statementEnd(t: string, from: number): number {
  let depth = 0;
  for (let i = from; i < t.length; i++) {
    if ('({['.includes(t[i]!)) depth += 1;
    else if (')}]'.includes(t[i]!)) depth -= 1;
    else if (t[i] === ';' && depth <= 0) return i;
  }
  return t.length;
}

function hasTopLevelArrow(t: string): boolean {
  let depth = 0;
  for (let i = 0; i < t.length - 1; i++) {
    if ('({['.includes(t[i]!)) depth += 1;
    else if (')}]'.includes(t[i]!)) depth -= 1;
    else if (depth === 0 && t[i] === '=' && t[i + 1] === '>') return true;
  }
  return false;
}

function functionsOf(t: string): Fn[] {
  const fns: Fn[] = [];
  for (const m of t.matchAll(/function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/g)) {
    const open = m.index! + m[0].length - 1;
    const body = t.indexOf('{', matchClose(t, open));
    if (body >= 0)
      fns.push({
        name: m[1]!,
        start: m.index!,
        end: matchClose(t, body) + 1,
        top: false,
      });
  }
  for (const m of t.matchAll(
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*/g,
  )) {
    const from = m.index! + m[0].length;
    const end = statementEnd(t, from);
    if (hasTopLevelArrow(t.slice(from, end)))
      fns.push({ name: m[1]!, start: m.index!, end, top: false });
  }
  // Функція верхнього рівня — така, що не лежить усередині іншої.
  for (const f of fns)
    f.top = !fns.some((g) => g !== f && g.start <= f.start && g.end >= f.end);
  return fns;
}

export function parseSources(files: Record<string, string>): Src[] {
  return Object.entries(files).map(([file, raw]) => {
    const text = blankComments(raw);
    const masked = maskStrings(text);
    return { file, text, masked, fns: functionsOf(masked) };
  });
}

const callOf = (name: string) =>
  new RegExp(`(?<![\\w$])${name.replace(/\$/g, '\\$')}\\s*\\(`, 'g');

/**
 * Замикання «читачів»: функція — читач, якщо в її тілі є базове читання або
 * виклик вже відомого читача, і вона не є крок із браузером (`eligible`).
 * `only` звужує розгляд (глобально — функції верхнього рівня; локально —
 * вкладені в одну функцію), `known` — уже відомі імена.
 */
function closure(
  src: Src,
  fns: Fn[],
  known: Set<string>,
  base: (body: string) => boolean,
  eligible: (body: string) => boolean,
): Set<string> {
  const names = new Set(known);
  for (let grew = true; grew;) {
    grew = false;
    for (const f of fns) {
      if (names.has(f.name)) continue;
      if (!eligible(src.masked.slice(f.start, f.end))) continue;
      const calls = [...names].some((n) =>
        callOf(n).test(src.masked.slice(f.start, f.end)),
      );
      if (base(src.text.slice(f.start, f.end)) || calls) {
        names.add(f.name);
        grew = true;
      }
    }
  }
  return names;
}

/** Діапазони аргументів `pollUntil(...)`. */
function pollRanges(t: string): [number, number][] {
  return [...t.matchAll(/pollUntil\s*\(/g)].map((m) => {
    const open = m.index! + m[0].length - 1;
    return [open, matchClose(t, open)];
  });
}

export function findDetachedDbReads(
  files: Record<string, string>,
  opts: { strict?: boolean } = {},
): { file: string; call: string }[] {
  const srcs = parseSources(files);
  const isRead = (b: string) => /(?<![\w$.])sql\s*\(/.test(b);
  const noPage = (b: string) => opts.strict || !/\bpage\b/.test(b);
  // Глобальні читачі — лише функції верхнього рівня (імпортуються між файлами);
  // вкладені імена (`read`, `fetch`…) діють тільки у своїй функції, інакше збіг
  // з параметром чи локальною змінною в іншому файлі давав би хибні читачі.
  const global = new Set<string>();
  for (let grew = true; grew;) {
    grew = false;
    for (const s of srcs) {
      const next = closure(
        s,
        s.fns.filter((f) => f.top),
        global,
        isRead,
        noPage,
      );
      for (const n of next)
        if (!global.has(n)) {
          global.add(n);
          grew = true;
        }
    }
  }
  global.delete('sql');
  global.delete('pollUntil');
  const direct = /state:\s*'detached'|expectGone\s*\(/;
  const waiters = new Set(
    srcs.flatMap((s) =>
      s.fns
        .filter((f) => direct.test(s.text.slice(f.start, f.end)))
        .map((f) => f.name),
    ),
  );
  if (opts.strict)
    for (let grew = true; grew;) {
      grew = false;
      for (const s of srcs)
        for (const n of closure(
          s,
          s.fns,
          waiters,
          (b) => direct.test(b),
          () => true,
        ))
          if (!waiters.has(n)) {
            waiters.add(n);
            grew = true;
          }
    }
  const out: { file: string; call: string }[] = [];
  for (const s of srcs) {
    const polls = pollRanges(s.masked);
    const inPoll = (i: number) => polls.some(([a, b]) => i > a && i < b);
    for (const top of s.fns.filter((f) => f.top)) {
      const body = s.text.slice(top.start, top.end);
      const mbody = s.masked.slice(top.start, top.end);
      const triggers = [
        ...[...body.matchAll(/state:\s*'detached'|expectGone\s*\(/g)].map(
          (m) => ({ at: m.index! + m[0].length, label: 'detached' }),
        ),
        ...[...waiters]
          .filter((w) => w !== top.name)
          .flatMap((w) =>
            [...mbody.matchAll(callOf(w))].map((m) => ({
              at: m.index! + m[0].length,
              label: w,
            })),
          ),
      ];
      if (triggers.length === 0) continue;
      const first = Math.min(...triggers.map((t) => t.at));
      const labelBefore = (i: number) =>
        triggers.filter((t) => t.at <= i).sort((a, b) => b.at - a.at)[0]!.label;
      const nested = s.fns.filter(
        (f) => !f.top && f.start >= top.start && f.end <= top.end,
      );
      const readers = closure(s, nested, global, isRead, noPage);
      readers.delete('pollUntil');
      const names = ['sql', ...readers]
        .map((n) => n.replace(/\$/g, '\\$'))
        .join('|');
      const reads = new RegExp(`(?<![\\w$])(?:${names})\\s*\\(`, 'g');
      for (const m of mbody.matchAll(reads)) {
        const at = top.start + m.index!;
        if (m.index! >= first && !inPoll(at))
          out.push({
            file: s.file,
            call: `${top.name}: ${m[0].replace(/\s*\($/, '')} після ${labelBefore(m.index!)}`,
          });
      }
    }
  }
  return out;
}

/** Усі файли смоку (без `wait.mjs`). */
export function scanDetachedDbReads(
  opts: { strict?: boolean } = {},
): { file: string; call: string }[] {
  const files = [...walk(DIR), join(ROOT, 'scripts/live-smoke.mjs')].filter(
    (f) => !f.endsWith('/wait.mjs'),
  );
  return findDetachedDbReads(
    Object.fromEntries(
      files.map((f) => [
        relative(DIR, f).replaceAll('\\', '/'),
        readFileSync(f, 'utf8'),
      ]),
    ),
    opts,
  );
}
