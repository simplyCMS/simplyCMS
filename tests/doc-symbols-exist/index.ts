import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { stripCommentsAndStrings } from '../support/source-text';
import { CODE_EXT, ROOT, walk } from './scan';

/**
 * Індекс ВИЗНАЧЕНЬ у коді для `doc-symbols-exist.test.ts`: що вважається
 * визначенням і що ні — у шапці тесту. Тут лише логіка; жодних `describe`/`it`.
 */

/** Цей тест і його допоміжні модулі цитують перевірювані символи — в індекс не йдуть. */
const SELF = [
  join(ROOT, 'tests/doc-symbols-exist.test.ts'),
  join(ROOT, 'tests/doc-symbols-exist/'),
];

/** Не продакшн-код: тести, харнес, моки, e2e — їхні згадки не доводять існування символу. */
const NON_PRODUCTION =
  /(?:^|\/)(?:__tests__|test-harness|tests|e2e)\/|\.test\.|\.spec\.|\.e2e\.|mock/i;

const IDENT = '[A-Za-z_$][\\w$]*';
const DEF_RES: RegExp[] = [
  // function/class/const/let/var/type/interface/enum (з export чи без)
  new RegExp(
    `\\b(?:function\\*?|class|const|let|var|type|interface|enum|namespace)\\s+(${IDENT})`,
    'g',
  ),
  // ключі об'єктів-реєстрів, властивості типів, члени enum: `name:` / `name?:`.
  // Lookbehind відсікає середню гілку тернарника (`a ? name : b`): там `name` — вираз.
  new RegExp(`(?:^|[\\s,{(;])(?<!\\?\\s*)(${IDENT})\\??\\s*:(?!:)`, 'gm'),
  // методи об'єктів/класів: `name(...) {` в кінці рядка
  new RegExp(
    `^\\s*(?:(?:public|private|protected|static|async|get|set|readonly)\\s+)*(${IDENT})\\s*(?:<[^>]*>)?\\([^;]*\\)\\s*(?::[^{;]+)?\\{\\s*$`,
    'gm',
  ),
  // змінні оточення, що читає код
  new RegExp(`\\benv\\.(${IDENT})`, 'g'),
];

/** Імена з деструктуризації `const { a, b: c } =` та `export { a, b as c }`. */
function bracedNames(code: string): string[] {
  const out: string[] = [];
  const res = [
    /\b(?:const|let|var)\s*\{([^}]*)\}\s*=/g,
    /\bexport\s*\{([^}]*)\}/g,
  ];
  for (const re of res)
    for (const m of code.matchAll(re))
      for (const part of (m[1] as string).split(',')) {
        const name = part
          .trim()
          .split(/\s+as\s+|\s*:\s*/)
          .pop();
        if (name && new RegExp(`^${IDENT}$`).test(name)) out.push(name);
      }
  return out;
}

/**
 * Іменовані імпорти зі СТОРОННІХ пакетів (`react`, `@tanstack/*`, `node:*`):
 * дока називає API бібліотеки, яке код справді викликає — зникне з бібліотеки,
 * зламається збірка. Імпорти з власних шляхів сюди не йдуть: вони не визначення.
 */
function thirdPartyImports(code: string): string[] {
  const out: string[] = [];
  const re =
    /\bimport\s+(?:type\s+)?(?:\w+\s*,\s*)?\{([^}]*)\}\s*from\s*(['"])([^'"]+)\2/g;
  for (const m of code.matchAll(re)) {
    if (
      /^(?:\.|simplycms|@simplycms|@themes|@plugins|@\/)/.test(m[3] as string)
    )
      continue;
    for (const part of (m[1] as string).split(',')) {
      const name = part
        .trim()
        .split(/\s+as\s+/)[0]
        ?.replace(/^type\s+/, '');
      if (name && new RegExp(`^${IDENT}$`).test(name)) out.push(name);
    }
  }
  return out;
}

/** Ідентифікатори, ВИЗНАЧЕНІ (не лише згадані) у тексті продакшн-файла. */
export function definedIdentifiers(
  src: string,
  isJson = false,
  fileName?: string,
): string[] {
  if (isJson)
    return [...src.matchAll(/"([A-Za-z_$][\w$]*)"\s*:/g)].map(
      (m) => m[1] as string,
    );
  // Ім'я файла — лише вид скрипта для лексера (`.tsx` — з JSX).
  const code = stripCommentsAndStrings(src, false, fileName);
  const out = [
    ...bracedNames(code),
    ...thirdPartyImports(stripCommentsAndStrings(src, true, fileName)),
  ];
  for (const re of DEF_RES)
    for (const m of code.matchAll(re)) out.push(m[1] as string);
  return out;
}

/** Гейт-символи з файлів тестів: лише експорти та `UPPER_SNAKE`-константи. */
export function gateIdentifiers(src: string, fileName?: string): string[] {
  const code = stripCommentsAndStrings(src, false, fileName);
  const out: string[] = [];
  for (const m of code.matchAll(
    new RegExp(
      `\\bexport\\s+(?:async\\s+)?(?:default\\s+)?(?:function\\*?|class|const|let|var|type|interface|enum)\\s+(${IDENT})`,
      'g',
    ),
  ))
    out.push(m[1] as string);
  for (const m of code.matchAll(
    /\b(?:const|let)\s+([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\b/g,
  ))
    out.push(m[1] as string);
  return out;
}

export function buildIndex(): Set<string> {
  const index = new Set<string>();
  // Власні експорти цього файлу (його текст у індекс не йде) — доки на них посилаються.
  index.add('DOC_SYMBOL_ALLOWLIST');
  const prod = (r: string): boolean =>
    CODE_EXT.test(r) && !NON_PRODUCTION.test(r);
  const gate = (r: string): boolean =>
    /\.(?:tsx?|mts|mjs)$/.test(r) && NON_PRODUCTION.test(r);
  const files = [
    ...[
      'packages',
      'src',
      'scripts',
      'apps',
      'plugins',
      'themes',
      'tools',
      'eslint-rules',
    ].flatMap((d) => {
      try {
        return walk(join(ROOT, d), prod);
      } catch {
        return [];
      }
    }),
    ...readdirSync(ROOT, { withFileTypes: true })
      .filter((e) => e.isFile() && /\.(?:ts|mjs|js|cjs|json)$/.test(e.name))
      .map((e) => join(ROOT, e.name)),
  ];
  const gateFiles = [
    ...['packages', 'src', 'scripts', 'tests'].flatMap((d) =>
      walk(join(ROOT, d), gate),
    ),
  ];
  for (const file of gateFiles) {
    if (SELF.some((p) => file === p || file.startsWith(p))) continue;
    for (const id of gateIdentifiers(readFileSync(file, 'utf8'), file))
      index.add(id);
  }
  for (const file of files) {
    let text: string;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    // Імʼя файла-модуля (`SettingsLogo.tsx` -> SettingsLogo) теж визначення.
    // Ключі i18n-каталогів — рядкові (`'auth.login.bannedContacts':`): беремо
    // кожен сегмент, бо доки називають їх по частинах.
    if (/\/i18n\/catalogs\//.test(file))
      for (const k of text.matchAll(/['"]([\w.]+)['"]\s*:/g))
        for (const seg of (k[1] as string).split('.')) index.add(seg);
    index.add(basename(file).replace(/(?:\.d)?\.[a-z]+$/, ''));
    for (const id of definedIdentifiers(text, file.endsWith('.json'), file))
      index.add(id);
  }
  return index;
}
