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
 * Пакети, які мігруються. Тести всередині них не скануються: кирилиця там —
 * це назви `describe`/`it` і дані фікстур («Товар p1», «Іван»), тобто не
 * інтерфейс.
 */
export const SCANNED_ROOTS = [
  'packages/storefront-routes/src',
  'packages/admin/src',
];

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
