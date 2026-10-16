import { describe, expect, it } from 'vitest';
import { toDraftValue, toRow } from '../property-value-mapping';

const BASE = {
  id: '11111111-1111-4111-8111-111111111111',
  propertyId: '22222222-2222-4222-8222-222222222222',
};
const draft = (
  v: Partial<{
    value: string | null;
    numericValue: string | null;
    optionId: string | null;
  }>,
) => ({
  value: null,
  numericValue: null,
  optionId: null,
  ...v,
});

describe('toDraftValue: контрол → значення агрегата за типом', () => {
  it('number/range: рядок у number; порожнє — null (рядок має зникнути)', () => {
    expect(
      toDraftValue(
        BASE,
        'number',
        draft({ numericValue: '5.5' }),
        undefined,
        'uk',
      ),
    ).toEqual({ ...BASE, kind: 'number', number: '5.5' });
    expect(
      toDraftValue(BASE, 'range', draft({ numericValue: '' }), undefined, 'uk'),
    ).toBeNull();
  });

  it('select: optionId; без нього — null', () => {
    const optionId = '33333333-3333-4333-8333-333333333333';
    expect(
      toDraftValue(BASE, 'select', draft({ optionId }), undefined, 'uk'),
    ).toEqual({ ...BASE, kind: 'select', optionId });
    expect(toDraftValue(BASE, 'select', draft({}), undefined, 'uk')).toBeNull();
  });

  it('boolean: "true"/"false" у bool', () => {
    expect(
      toDraftValue(BASE, 'boolean', draft({ value: 'false' }), undefined, 'uk'),
    ).toMatchObject({ bool: false });
  });

  it('color: рядок кольору', () => {
    expect(
      toDraftValue(BASE, 'color', draft({ value: '#ff0000' }), undefined, 'uk'),
    ).toMatchObject({ color: '#ff0000' });
  });

  it('text: пише лише активну мову, тексти решти зберігає', () => {
    const existing = {
      ...BASE,
      kind: 'text' as const,
      text: { uk: 'a', en: 'b' },
    };
    expect(
      toDraftValue(BASE, 'text', draft({ value: 'c' }), existing, 'en'),
    ).toMatchObject({ text: { uk: 'a', en: 'c' } });
  });

  it('text: очищена остання мова — null; очищена одна з двох — лишається інша', () => {
    const only = { ...BASE, kind: 'text' as const, text: { uk: 'a' } };
    expect(
      toDraftValue(BASE, 'text', draft({ value: '' }), only, 'uk'),
    ).toBeNull();
    const two = { ...only, text: { uk: 'a', en: 'b' } };
    expect(
      toDraftValue(BASE, 'text', draft({ value: '' }), two, 'uk'),
    ).toMatchObject({ text: { uk: null, en: 'b' } });
  });
});

describe('toRow: значення агрегата → рядок контролу', () => {
  it('текст мовою вкладки; boolean і color — у value; number — у numericValue', () => {
    expect(
      toRow({ ...BASE, kind: 'text', text: { uk: 'a' } }, 'uk').value,
    ).toBe('a');
    expect(
      toRow({ ...BASE, kind: 'text', text: { uk: 'a' } }, 'en').value,
    ).toBeNull();
    expect(toRow({ ...BASE, kind: 'boolean', bool: true }, 'uk').value).toBe(
      'true',
    );
    expect(
      toRow({ ...BASE, kind: 'color', color: '#fff000' }, 'uk').value,
    ).toBe('#fff000');
    expect(
      toRow({ ...BASE, kind: 'number', number: '3' }, 'uk').numericValue,
    ).toBe('3');
  });
});
