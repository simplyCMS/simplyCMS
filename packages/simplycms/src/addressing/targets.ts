import { sql, type SQL } from 'drizzle-orm';

/**
 * Реєстр видів цілей адрес (Р22): єдине місце, де вид сутності зв'язано з колонкою реєстру,
 * полем Drizzle, ланцюгом замків і сегментом шляху відмови. Новий вид — рядок тут; SQL і
 * типи адрес читають його, а не повторюють літерали (`product_id` більше не розсіяний по модулях).
 */
export interface PathKindSpec {
  readonly kind: string;
  /** Колонка-ціль у `url_paths`. */
  readonly column: string;
  /** Те саме поле в Drizzle-таблиці (camelCase). */
  readonly field: string;
  /** Корінь агрегата, чий рядок блокується `FOR KEY SHARE` першим. */
  readonly rootTable: string;
  /** Порядок замків «корінь → нащадок» (порядок замків агрегата). */
  readonly lockChain: readonly string[];
  /** Перший сегмент шляху в `language_incomplete`: `[pathSegment, id, stage]`. */
  readonly pathSegment: string;
}

export interface TokenKindSpec {
  readonly kind: string;
  /** Значення `slug_tokens.token_kind`. */
  readonly tokenKind: string;
  readonly column: string;
  readonly field: string;
  readonly scopeColumn: 'scope_id';
  readonly lockChain: readonly string[];
  readonly pathSegment: string;
}

export const PATH_KINDS = [
  {
    kind: 'product',
    column: 'product_id',
    field: 'productId',
    rootTable: 'products',
    lockChain: ['products'],
    pathSegment: 'products',
  },
] as const satisfies readonly PathKindSpec[];

export const TOKEN_KINDS = [
  {
    kind: 'modification',
    tokenKind: 'modification',
    column: 'modification_id',
    field: 'modificationId',
    scopeColumn: 'scope_id',
    lockChain: ['products', 'product_modifications'],
    pathSegment: 'products',
  },
] as const satisfies readonly TokenKindSpec[];

export type PathKind = (typeof PATH_KINDS)[number];
export type TokenKind = (typeof TOKEN_KINDS)[number];

/** Сутність, якій належить адреса. */
export type AddressTarget = { kind: PathKind['kind']; id: string };

/** Сутність, якій належить токен; `scopeId` — область (для модифікації товар). */
export type TokenTarget = {
  kind: TokenKind['kind'];
  id: string;
  scopeId: string;
};

const byKind = <T extends { kind: string }>(
  list: readonly T[],
  kind: string,
): T => {
  const spec = list.find((s) => s.kind === kind);
  if (!spec) throw new Error(`[addressing] невідомий вид цілі «${kind}»`);
  return spec;
};

export const pathKindOf = (kind: AddressTarget['kind']): PathKind =>
  byKind(PATH_KINDS, kind);
export const tokenKindOf = (kind: TokenTarget['kind']): TokenKind =>
  byKind(TOKEN_KINDS, kind);

/** Сегмент шляху відмови для виду з будь-якого реєстру. */
export const pathSegmentOf = (kind: string): string =>
  byKind<{ kind: string; pathSegment: string }>(
    [...PATH_KINDS, ...TOKEN_KINDS],
    kind,
  ).pathSegment;

/** Ідентифікатор колонки/таблиці з реєстру для `sql.raw` (лише літерали реєстру, не ввід). */
export const raw = (identifier: string): SQL => sql.raw(identifier);
