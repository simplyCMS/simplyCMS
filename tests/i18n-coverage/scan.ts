import ts from 'typescript';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Знайдений кириличний рядок інтерфейсу. */
export interface Hardcoded {
  file: string;
  line: number;
  kind: string;
  text: string;
}

const CYRILLIC = /[Ѐ-ӿ]/;

/**
 * Мігровані зони. Тести всередині них не скануються: кирилиця там — це назви
 * `describe`/`it` і дані фікстур («Товар p1», «Іван»), тобто не інтерфейс.
 *
 * 🔴 Список розширено 2026-08-09 з двох пакетів на всю воронку покупки, host і
 * теми. До цього AST-тест доводив завершеність ЛИШЕ для `storefront-routes` і
 * `admin`, через що 293 хардкоджені рядки в `*-ui` лишались невидимими для
 * гейтів — борг закрили аж тоді, коли його знайшли ручним сканом по всіх
 * теках. Тепер регрес у будь-якій із цих зон валить `pnpm test`.
 */
export const SCANNED_ROOTS = [
  'src',
  'packages/storefront-routes/src',
  'packages/admin/src',
  'packages/cart-ui/src',
  'packages/catalog-ui/src',
  'packages/checkout-ui/src',
  'packages/profile-ui/src',
  'packages/reviews-ui/src',
  'packages/core/src',
  'packages/storefront/src',
  'packages/theme-system/src',
  'packages/plugin-system/src',
  'themes/default',
  'themes/solarstore',
];

/**
 * Файли, які самі Є каталогом перекладів, а не його споживачем.
 *
 * 🔴 Тема несе власні повідомлення (`ThemeModule.messages`, контракт v2.1), і
 * український бік цього каталогу — кирилиця за побудовою. Сканувати його
 * означало б вимагати перекладу від перекладу. Core-каталоги
 * (`packages/i18n/src/catalogs/**`) у `SCANNED_ROOTS` не входять узагалі й
 * тому окремого винятку не потребують.
 */
const CATALOG_FILES = /(^|\/)messages\.ts$/;

function walk(dir: string, out: string[]): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') walk(full, out);
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

export function sourceFiles(repoRoot: string): string[] {
  return SCANNED_ROOTS.flatMap((root) => walk(join(repoRoot, root), []))
    .map((f) => relative(repoRoot, f))
    .filter((f) => !CATALOG_FILES.test(f))
    .sort();
}

/**
 * AST-прохід, а не regexp по тексту.
 *
 * 🔴 Причина принципова: коментарі українською — вимога стилю проєкту (їх у цих
 * пакетах 325 рядків), а в AST вони лежать у trivia й у обхід вузлів не
 * потрапляють за побудовою. Пошук по тексту не відрізнив би їх від хардкоду й
 * тягнув би за собою правки, що знищують документацію.
 */
export function scanFile(repoRoot: string, file: string): Hardcoded[] {
  const src = readFileSync(join(repoRoot, file), 'utf8');
  const sf = ts.createSourceFile(
    file,
    src,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found: Hardcoded[] = [];

  const record = (node: ts.Node, kind: string, text: string) => {
    found.push({
      file,
      line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
      kind,
      text: text.trim().slice(0, 60),
    });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      if (CYRILLIC.test(node.text) && node.text.trim()) {
        record(node, 'JSXText', node.text);
      }
    } else if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node)
    ) {
      if (CYRILLIC.test(node.text)) record(node, 'StringLiteral', node.text);
    } else if (ts.isTemplateExpression(node)) {
      const raw = node.getText(sf);
      if (CYRILLIC.test(raw)) record(node, 'TemplateExpression', raw);
    }
    ts.forEachChild(node, visit);
  };

  visit(sf);
  return found;
}

export function scanAll(repoRoot: string): Hardcoded[] {
  return sourceFiles(repoRoot).flatMap((f) => scanFile(repoRoot, f));
}
