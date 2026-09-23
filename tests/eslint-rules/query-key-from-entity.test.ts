import { describe, expect, it } from 'vitest';
import { Linter } from 'eslint';
import rule from '../../eslint-rules/query-key-from-entity.mjs';

const linter = new Linter();
const lint = (code: string) =>
  linter.verify(code, {
    plugins: { s: { rules: { 'query-key-from-entity': rule } } },
    rules: { 's/query-key-from-entity': 'error' },
    languageOptions: { ecmaVersion: 2024, sourceType: 'module' },
  });

describe('query-key-from-entity', () => {
  it.each([
    ['прямий літерал', "const q = { queryKey: ['banners'] };"],
    ['константа-масив', "const K = ['banners']; const q = { queryKey: K };"],
    ['умовний вибір', "const q = { queryKey: cond ? ['a'] : ['b', id] };"],
  ])('валить (базовий кейс): %s', (_label, code) => {
    expect(lint(code)).toHaveLength(1);
  });

  it('не валить: перший сегмент з реєстру ENTITY', () => {
    const code = 'const q = { queryKey: entityKey(ENTITY.banners).all() };';
    expect(lint(code)).toHaveLength(0);
  });

  describe("другий сегмент буквальний 'list' — форма collectionKey ВРУЧНУ (Е3-15′)", () => {
    it('валить: [ENTITY.x, "list", …] поза admin-data', () => {
      const code =
        "const q = { queryKey: [ENTITY.products, 'list', 'featured'] };";
      const messages = lint(code);
      expect(messages).toHaveLength(1);
      expect(messages[0].messageId).toBe('bareListSegment');
    });

    it('валить: у гілці тернарника теж', () => {
      const code =
        "const q = { queryKey: cond ? [ENTITY.x, 'list'] : [ENTITY.x, 'variant', 'y'] };";
      expect(lint(code)).toHaveLength(1);
    });

    it('НЕ валить: другий сегмент інший рядок (variant/scoped-форма)', () => {
      const code =
        "const q = { queryKey: [ENTITY.products, 'variant', 'featured'] };";
      expect(lint(code)).toHaveLength(0);
    });

    it('НЕ валить: collectionKey(...) — виклик функції, не масив-літерал', () => {
      const code = 'const q = { queryKey: collectionKey(ENTITY.products) };';
      expect(lint(code)).toHaveLength(0);
    });
  });
});
