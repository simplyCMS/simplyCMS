// @vitest-environment jsdom
/**
 * `useModifications` — чернетка модифікацій у формі картки: жодної мережі,
 * дефолт єдиний, порядок — перенумерація, видалення прибирає фото й значення.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import type { UseFormReturn } from 'react-hook-form';
import type { ProductFormValues } from '../../edit/product-form-schema';
import { CardHarness, mod } from '../../__tests__/card-harness';
import { useModifications } from '../useModifications';

afterEach(() => cleanup());

const A = '11111111-1111-4111-8111-aaaaaaaaaaaa';
const B = '22222222-2222-4222-8222-bbbbbbbbbbbb';

function setup(values: Partial<ProductFormValues> = {}) {
  const out: {
    api?: ReturnType<typeof useModifications>;
    form?: UseFormReturn<ProductFormValues>;
  } = {};
  function Probe() {
    out.api = useModifications();
    return null;
  }
  render(
    <CardHarness values={values} onForm={(f) => (out.form = f)}>
      <Probe />
    </CardHarness>,
  );
  return out as Required<typeof out>;
}

const form = (name: string, extra: object = {}) => ({
  names: { uk: name, en: '' },
  tokens: { uk: '', en: '' },
  sku: '',
  isDefault: false,
  images: [],
  ...extra,
});

describe('useModifications', () => {
  it('save нової: sortOrder = max+1, чернетка без мережі', () => {
    const s = setup({ modifications: [mod(A, 'A', { sortOrder: 4 })] });
    act(() => s.api.save(B, form('B')));
    expect(
      s.form.getValues('modifications').map((m) => [m.id, m.sortOrder]),
    ).toEqual([
      [A, 4],
      [B, 5],
    ]);
    expect(s.form.getValues('modifications')[1]!.texts.uk).toBe('B');
  });

  it('save існуючої зберігає її sortOrder і оновлює поля', () => {
    const s = setup({ modifications: [mod(A, 'A', { sortOrder: 2 })] });
    act(() => s.api.save(A, form('A2', { sku: 'S' })));
    expect(s.form.getValues('modifications')[0]).toMatchObject({
      sortOrder: 2,
      sku: 'S',
      texts: { uk: 'A2' },
    });
  });

  it('isDefault у save знімає прапор з решти', () => {
    const s = setup({ modifications: [mod(A, 'A', { isDefault: true })] });
    act(() => s.api.save(B, form('B', { isDefault: true })));
    expect(s.form.getValues('modifications').map((m) => m.isDefault)).toEqual([
      false,
      true,
    ]);
  });

  it('setDefault робить дефолтною одну', () => {
    const s = setup({
      modifications: [
        mod(A, 'A', { isDefault: true }),
        mod(B, 'B', { sortOrder: 1 }),
      ],
    });
    act(() => s.api.setDefault(B));
    expect(s.form.getValues('modifications').map((m) => m.isDefault)).toEqual([
      false,
      true,
    ]);
  });

  it('reorder міняє місцями сусідів і перенумеровує; на краю — нічого', () => {
    const s = setup({
      modifications: [mod(A, 'A'), mod(B, 'B', { sortOrder: 1 })],
    });
    act(() => s.api.reorder(B, 'up'));
    expect(s.api.modifications.map((m) => [m.id, m.sortOrder])).toEqual([
      [B, 0],
      [A, 1],
    ]);
    act(() => s.api.reorder(B, 'up'));
    expect(s.api.modifications[0]!.id).toBe(B);
  });

  it('save з фото кладе їх у images під цією модифікацією; remove прибирає фото і значення', () => {
    const s = setup({ modifications: [mod(A, 'A')] });
    act(() => s.api.save(A, form('A', { images: ['k1'] })));
    expect(s.form.getValues('images')).toMatchObject([
      { storageKey: 'k1', modificationId: A },
    ]);
    s.form.setValue('propertyValues', [
      { id: B, propertyId: B, kind: 'boolean', bool: true, modificationId: A },
    ]);
    act(() => s.api.remove(A));
    expect(s.form.getValues('modifications')).toEqual([]);
    expect(s.form.getValues('images')).toEqual([]);
    expect(s.form.getValues('propertyValues')).toEqual([]);
  });
});
