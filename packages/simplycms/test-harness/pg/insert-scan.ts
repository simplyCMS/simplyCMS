// Спільний сканер вставок для гейтів контракту id (трек V2-К3, етап Е0).
//
// Гейти дивляться на той самий код із різних боків і мусять різати текст
// ОДНАКОВО, інакше «полагоджений» скан в одному місці лишає дірку в другому:
//   • `__tests__/explicit-ids.test.ts` — інваріант: кожна вставка поза
//     задокументованими виїмками передає `id` (адмінка без виїмок);
//   • решта споживачів — `insert-scan.test.ts`, `mutation-cache-sync-coverage`,
//     `storage-direct-calls`, `storage-port-consumers`.
// Тому балансування дужок і розпізнавання поля `id` живуть тут, в одному
// місці, а не двома копіями.
//
// 🔴 Це НЕ парсер TS. Балансування дужок не розрізняє коментарі, а `hasIdField`
// перед розбором їх прибирає; не розуміє підстановок `${…}` усередині шаблонних рядків (backtick-рядок трактується
// як непрозорий текст до найближчого закривного backtick). Для коду, який
// реально сканується, цього досить; хитрий обхід зупинить ревʼю людиною.

import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Індекс символу, що закриває дужку, відкриту в `openIndex`
 * (`src[openIndex]` — сам відкривний символ `(`, `{` або `[`). Вміст
 * рядкових літералів ігнорується, щоб дужка всередині рядка не збила глибину.
 */
export function findMatchingClose(src: string, openIndex: number): number {
  const open = src[openIndex];
  const close = open === '(' ? ')' : open === '{' ? '}' : ']';
  let depth = 0;
  let inString: string | null = null;
  for (let i = openIndex; i < src.length; i++) {
    const ch = src[i];
    if (inString) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return src.length - 1;
}

/**
 * Текст аргументу виклику, чия відкривна дужка стоїть в `openParenIdx`.
 * Один шар обгортки-масиву розгортається (`([x])` → `x`), бо
 * `db.insert(t).values([payload])` — та сама вставка, що й `.values(payload)`.
 */
export function callArgument(src: string, openParenIdx: number): string {
  const closeIdx = findMatchingClose(src, openParenIdx);
  const arg = src.slice(openParenIdx + 1, closeIdx).trim();
  const asArray = /^\[([\s\S]*)\]$/.exec(arg);
  return asArray ? asArray[1].replace(/,\s*$/, '').trim() : arg;
}

/**
 * Поле `id` обʼєкта в двох формах:
 *   • ключ `id:` — попередній символ: початок тексту, пробіл, `{` або `,`
 *     (інакше скан зараховував би `product_id:`, `discount_id:`…);
 *   • шортхенд `{ id, … }` / `{ …, id }` (Е5б Task 8) — перед `id` (через
 *     пробіли) лише `{`, `,` або початок, після — `,` або `}`. Двокрапка
 *     перед ним виключена: `{ orderItemId: id }` — змінна `id` як ЗНАЧЕННЯ
 *     чужого ключа, а не поле.
 * 🔴 Межа без парсера: `fn(a, id, b)` у payload теж читається як шортхенд.
 */
export const ID_FIELD = /(^|[\s{,])id:\s*\S|(^|[{,])\s*id\s*[,}]/;

/**
 * Прибирає з тексту коментарі й ВМІСТ рядкових літералів (лапки лишаються),
 * щоб `id:` у коментарі чи рядку не рахувався полем. Без парсера: `${…}` у
 * шаблонному рядку — частина рядка (див. шапку файлу).
 */
export function stripCommentsAndStrings(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (ch === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end < 0 ? text.length : end + 1;
      out += ' ';
    } else if (ch === '"' || ch === "'" || ch === '`') {
      i++;
      while (i < text.length && text[i] !== ch) {
        if (text[i] === '\\') i++;
        i++;
      }
      out += ch + ch;
    } else {
      out += ch;
    }
  }
  return out;
}

/** Елементи верхнього рівня через кому (дужки й рядки вже не містять ком). */
function topLevelItems(text: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(' || ch === '{' || ch === '[') depth++;
    else if (ch === ')' || ch === '}' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) {
      items.push(text.slice(start, i));
      start = i + 1;
    }
  }
  items.push(text.slice(start));
  return items.map((item) => item.trim()).filter((item) => item !== '');
}

/**
 * Чи передає цей фрагмент поле `id`. Для масиву рядків (`{…}, {…}` — вигляд
 * `callArgument` після розгортання `[…]`) `id` мусить бути в КОЖНОМУ
 * елементі: один елемент із `id` не виправдовує решту. Коментарі й рядкові
 * літерали перед розбором прибираються.
 */
export function hasIdField(text: string): boolean {
  const items = topLevelItems(stripCommentsAndStrings(text));
  if (items.length === 0) return false;
  return items.every((item) => ID_FIELD.test(item));
}

/** Рекурсивно всі `*.ts`/`*.tsx` теки. */
export function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));
}
