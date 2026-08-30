import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ADMIN = resolve(import.meta.dirname, '../packages/simplycms/src/admin');

/**
 * Ратчет застарілого шару. Адмінка на supabase-js не виконується на
 * чистому Postgres і повністю переписується в Е1–Е6 (рішення власника
 * 2026-08-29), тому наявні вставки без `id` лишаються як є — але їхня
 * кількість може тільки ЗМЕНШУВАТИСЬ. Нова вставка валить тест.
 *
 * 🔴 Не «полагодити» цей файл підняттям константи: кожен запис звідси
 * зникає разом із переписаною сторінкою (Е1–Е6), а не додається новий.
 *
 * 🔴 Число виміряне, не взяте з плану на віру. Регекс з чернетки плану
 * (`/\.insert\(\s*(\{|\[)/g`) бачить лише форми `.insert({` і `.insert([`
 * — 19 із 27 фактичних викликів `.insert(` у цьому шарі; найпоширеніший
 * стиль коду тут — `.insert(payload)` (змінна без дужок одразу після
 * `(`) — регекс плану його не бачить УЗАГАЛІ. Гірше: той самий регекс дав
 * ОДИН хибний ПРОХІД (PropertyOptionEdit.tsx) — вікно в 400 символів ПІСЛЯ
 * виклику зачепило `return { id: optionId }` із сусідньої гілки `else`,
 * тоді як сам payload вставки `id` не містить. Тобто вузький скан не
 * просто пропускав форми — він і на тих формах, які бачив, міг помилково
 * вважати вставку безпечною. Тому тут — ширший скан (нижче) і КОНСТАНТА
 * дорівнює тому, що він виміряв.
 */
const KNOWN_WITHOUT_ID = 27;

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && /\.tsx?$/.test(e.name))
    .map((e) => join(e.parentPath, e.name));
}

/**
 * Індекс символу, що закриває дужку, відкриту в `openIndex`
 * (`src[openIndex]` — сам відкривний символ `(`, `{` або `[`). Ігнорує
 * вміст рядкових літералів (`'...'`, `"..."`, шаблонних `` `...` ``), щоб
 * дужка всередині рядка не збила глибину.
 *
 * 🔴 Межа: це НЕ парсер JS/TS — не розрізняє коментарі (`//`, `/* *​/`) і
 * не розуміє шаблонних виразів `${...}` усередині backtick-рядків (весь
 * backtick-рядок трактується як непрозорий текст до найближчого
 * закривного backtick). У коді, що реально сканується (`.insert(...)`
 * у `src/admin`), таких конструкцій немає — перевірено вручну для всіх
 * 27 викликів на момент написання тесту.
 */
function findMatchingClose(src: string, openIndex: number): number {
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
 * Для форми `.insert(ідентифікатор)` шукає НАЙБЛИЖЧЕ ПОПЕРЕДНЄ (за
 * позицією в тексті файлу) оголошення `const ідентифікатор = {...}` /
 * `let ідентифікатор = {...}` / `const ідентифікатор: Тип = {...}` і
 * повертає текст його ініціалізатора — саме той об'єкт, що йде у вставку.
 *
 * 🔴 Межа: це евристика за порядком у файлі, не за областями видимості.
 * Якщо той самий ідентифікатор оголошено кілька разів у різних функціях
 * одного файлу, буде взято найближче ПОПЕРЕДНЄ оголошення в тексті —
 * для мутацій `mutationFn: async (...) => { const payload = {...}; ... }`
 * (єдиний патерн, що трапляється в цьому шарі) це завжди правильна
 * функція, бо `payload`/`data` оголошується всередині тієї самої
 * замикання прямо перед використанням. Якщо оголошення не знайдено
 * (наприклад, ідентифікатор — це параметр функції, а не `const`/`let`) —
 * повертає `null`, і виклик трактується як «без id»: невизначеність тут
 * навмисно веде до офендера, а не до тихого проходу (хибний прохід —
 * дірка в гейті; хибний офендер — лише шум у шарі, який однаково
 * переписується).
 */
function resolveIdentifierInitializer(
  src: string,
  ident: string,
  beforeIndex: number,
): string | null {
  const declRe = new RegExp(`\\b(?:const|let)\\s+${ident}\\b`, 'g');
  let lastIndex = -1;
  let m: RegExpExecArray | null;
  while ((m = declRe.exec(src)) !== null) {
    if (m.index >= beforeIndex) break;
    lastIndex = m.index;
  }
  if (lastIndex === -1) return null;
  const eqIdx = src.indexOf('=', lastIndex);
  const braceIdx = src.indexOf('{', lastIndex);
  if (braceIdx === -1 || eqIdx === -1 || braceIdx < eqIdx) return null;
  const closeIdx = findMatchingClose(src, braceIdx);
  return src.slice(braceIdx, closeIdx + 1);
}

// `id:` як ключ поля об'єкта: попередній символ — початок вікна, пробільний
// символ, `{` або `,` — щоб НЕ зачепити `property_id:`, `discount_id:` тощо.
const ID_FIELD = /(^|[\s{,])id:\s*\S/;

describe('застарілий шар адмінки: ратчет вставок без id', () => {
  it(`вставок без id не більше ніж ${KNOWN_WITHOUT_ID}`, () => {
    const offenders: string[] = [];
    let total = 0;
    for (const file of tsxFiles(ADMIN)) {
      const src = readFileSync(file, 'utf8');
      const re = /\.insert\(/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) {
        total++;
        const openParenIdx = m.index + m[0].length - 1;
        const closeParenIdx = findMatchingClose(src, openParenIdx);
        let arg = src.slice(openParenIdx + 1, closeParenIdx).trim();

        // Розгортаємо один шар обгортки-масиву: `.insert([x])` → `x`.
        const arrMatch = /^\[([\s\S]*)\]$/.exec(arg);
        if (arrMatch) arg = arrMatch[1].replace(/,\s*$/, '').trim();

        const identMatch = /^([A-Za-z_$][\w$]*)$/.exec(arg);
        let window: string;
        if (identMatch) {
          // Форма `.insert(payload)` / `.insert([payload])` — та, яку
          // вузький регекс плану не бачить узагалі.
          window =
            resolveIdentifierInitializer(src, identMatch[1], m.index) ?? '';
        } else {
          // Літерал `{...}`/`[...]` або вираз (`list.map(x => ({...}))`) —
          // перевіряємо сам аргумент, а не довільне вікно після виклику.
          window = arg;
        }

        if (!ID_FIELD.test(window)) {
          offenders.push(`${relative(ADMIN, file)}@${m.index}`);
        }
      }
    }
    expect(
      offenders.length,
      `вставок без id: ${offenders.length} (усього .insert(: ${total})\n${offenders.join('\n')}`,
    ).toBeLessThanOrEqual(KNOWN_WITHOUT_ID);
  });
});
