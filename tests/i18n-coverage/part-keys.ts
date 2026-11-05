import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { messages as ukAdmin } from '../../packages/simplycms/src/i18n/catalogs/uk/admin/index';
import { messages as ukMail } from '../../packages/simplycms/src/i18n/catalogs/uk/mail';
import { SCANNED_ROOTS, sourceFiles } from './scan';

/**
 * Правило частин каталогу (І43): ключ частини `admin` бачить лише адмінка, ключ `mail` —
 * лише модуль листів. Вітрина вантажить тільки `base`, тож `t('admin.…')` там віддав би
 * голий ключ у рантаймі, а зелений typecheck цього не бачить (`MessageKey` — union усіх
 * частин). Множини ключів — з каталогів `uk`: вони повні й є джерелом правди.
 */
export interface PartKeys {
  readonly admin: ReadonlySet<string>;
  readonly mail: ReadonlySet<string>;
}

export const PART_KEYS: PartKeys = {
  admin: new Set(Object.keys(ukAdmin)),
  mail: new Set(Object.keys(ukMail)),
};

/** Корені, де ключі `admin` на місці (з кінцевим `/`: `admin-server` до них НЕ належить). */
export const ADMIN_ROOTS = [
  'packages/simplycms/src/admin/',
  'packages/simplycms/src/admin-data/',
  'packages/simplycms/routes/admin/',
];

/** Корінь, де на місці ключі `mail`. */
export const MAIL_ROOTS = ['packages/simplycms/src/mail/'];

export interface PartKeyViolation {
  file: string;
  line: number;
  key: string;
  part: 'admin' | 'mail';
}

const inRoots = (file: string, roots: readonly string[]) =>
  roots.some((root) => file.startsWith(root));

/**
 * Порушення в одному файлі за його вмістом (чиста функція — на ній негативні контролі).
 * AST, а не regexp: дивимось лише рядкові літерали, коментарі в обхід не потрапляють.
 */
export function partKeyViolationsIn(
  file: string,
  source: string,
  keys: PartKeys = PART_KEYS,
): PartKeyViolation[] {
  const sf = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found: PartKeyViolation[] = [];
  const check = (node: ts.Node, text: string) => {
    for (const part of ['admin', 'mail'] as const) {
      const roots = part === 'admin' ? ADMIN_ROOTS : MAIL_ROOTS;
      if (keys[part].has(text) && !inRoots(file, roots)) {
        const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line;
        found.push({ file, line: line + 1, key: text, part });
      }
    }
  };
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      check(node, node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** Файли правила: усе ядро й зони `SCANNED_ROOTS`, крім самих каталогів. */
export function partKeyFiles(repoRoot: string): string[] {
  const roots = [...SCANNED_ROOTS, 'packages/simplycms/src'];
  return [...new Set(roots.flatMap((root) => sourceFiles(repoRoot, [root])))]
    .filter((f) => !f.startsWith('packages/simplycms/src/i18n/catalogs/'))
    .sort();
}

export function partKeyViolations(repoRoot: string): PartKeyViolation[] {
  return partKeyFiles(repoRoot).flatMap((file) =>
    partKeyViolationsIn(file, readFileSync(join(repoRoot, file), 'utf8')),
  );
}
