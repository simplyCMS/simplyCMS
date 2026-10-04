// Спільний сканер вставок для гейтів контракту id (трек V2-К3, етап Е0).
//
// Два гейти дивляться на той самий код із різних боків і мусять різати текст
// ОДНАКОВО, інакше «полагоджений» скан в одному місці лишає дірку в другому:
//   • `__tests__/explicit-ids.test.ts` — інваріант: кожна вставка поза
//     задокументованими виїмками передає `id`;
//   • `tests/admin-inserts-need-id.test.ts` — ратчет застарілого шару адмінки.
// Тому балансування дужок і розпізнавання поля `id` живуть тут, в одному
// місці, а не двома копіями.
//
// 🔴 Це НЕ парсер TS. Він не розрізняє коментарі (`//`, `/* */`) і не розуміє
// підстановок `${…}` усередині шаблонних рядків (backtick-рядок трактується
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
 * `supabase.from(t).insert([payload])` — та сама вставка, що й `.insert(payload)`.
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

/** Чи передає цей фрагмент поле `id`. */
export const hasIdField = (text: string): boolean => ID_FIELD.test(text);

/** Рекурсивно всі `*.ts`/`*.tsx` теки. */
export function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));
}
