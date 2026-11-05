import { getTableColumns } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { ADDRESS_KIND } from 'simplycms/domain';
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

  it('вид унікальний по обох реєстрах разом: pathSegmentOf шукає за kind у PATH_KINDS і TOKEN_KINDS', () => {
    const kinds = [...PATH_KINDS, ...TOKEN_KINDS].map((s) => s.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
    expect(pathSegmentOf('modification')).toBe('products');
    expect(() => pathSegmentOf('nope')).toThrow();
  });

  it('охоронець: copy*/copy-candidates беруть лише товар і модифікацію', () => {
    const msg = 'ітерувати реєстр у copy*/copy-candidates — зріз Б';
    expect(PATH_KINDS.length, msg).toBe(1);
    expect(TOKEN_KINDS.length, msg).toBe(1);
  });

  it('kind і token_kind беруться з домену (спільно з вітриною)', () => {
    expect(PATH_KINDS[0].kind).toBe(ADDRESS_KIND.product);
    expect(TOKEN_KINDS[0].kind).toBe(ADDRESS_KIND.modification);
    expect(TOKEN_KINDS[0].tokenKind).toBe(ADDRESS_KIND.modification);
  });
});
