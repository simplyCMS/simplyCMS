import { getTableColumns } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { slugTokens, urlPaths } from 'simplycms/schema';
import { PATH_KINDS, TOKEN_KINDS, pathSegmentOf } from '../targets';

describe('реєстр видів цілей адрес', () => {
  it.each(PATH_KINDS)(
    'вид адреси «$kind»: колонка й поле є в url_paths, ланцюг замків починається з кореня',
    (spec) => {
      const cols = getTableColumns(urlPaths) as Record<
        string,
        { name: string }
      >;
      expect(cols[spec.field]?.name).toBe(spec.column);
      expect(spec.lockChain[0]).toBe(spec.rootTable);
    },
  );

  it.each(TOKEN_KINDS)(
    'вид токена «$kind»: колонка й область є в slug_tokens, ланцюг замків починається з кореня',
    (spec) => {
      const cols = getTableColumns(slugTokens) as Record<
        string,
        { name: string }
      >;
      expect(cols[spec.field]?.name).toBe(spec.column);
      expect(Object.values(cols).some((c) => c.name === spec.scopeColumn)).toBe(
        true,
      );
      expect(spec.lockChain[0]).toBe('products');
    },
  );

  it('вид кожного реєстру унікальний, сегмент шляху відмови знаходиться', () => {
    const kinds = [...PATH_KINDS, ...TOKEN_KINDS].map((s) => s.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
    expect(pathSegmentOf('modification')).toBe('products');
    expect(() => pathSegmentOf('nope')).toThrow();
  });
});
