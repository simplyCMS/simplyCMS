// @vitest-environment jsdom
/**
 * `usePropertyValues` — значення властивостей як чернетка форми картки:
 * скаляр (insert/update/delete), multiselect (рядок на опцію), значення
 * модифікації, текст мовою вкладки, серверна помилка біля поля.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import type { UseFormReturn } from 'react-hook-form';
import type { ProductFormValues } from '../../edit/product-form-schema';
import { CardHarness } from '../../__tests__/card-harness';
import { usePropertyValues } from '../usePropertyValues';

afterEach(() => cleanup());

const P = '11111111-1111-4111-8111-111111111111';
const O1 = '22222222-2222-4222-8222-222222222222';
const O2 = '33333333-3333-4333-8333-333333333333';
const MOD = '44444444-4444-4444-8444-444444444444';
const prop = (propertyType: 'text' | 'number' | 'multiselect' | 'select') => ({
  id: P,
  propertyType,
});
const none = { value: null, numericValue: null, optionId: null };

function setup(
  target: 'product' | 'modification' = 'product',
  values: Partial<ProductFormValues> = {},
  opts: { active?: string; card?: object } = {},
) {
  const out: {
    api?: ReturnType<typeof usePropertyValues>;
    form?: UseFormReturn<ProductFormValues>;
  } = {};
  function Probe() {
    out.api = usePropertyValues(target, target === 'product' ? 'p' : MOD);
    return null;
  }
  render(
    <CardHarness
      values={values}
      active={opts.active}
      card={opts.card}
      onForm={(f) => (out.form = f)}
    >
      <Probe />
    </CardHarness>,
  );
  return out as Required<typeof out>;
}

describe('usePropertyValues', () => {
  it('перше значення скаляра — новий рядок із клієнтським uuid, без мережі', () => {
    const s = setup();
    act(() => s.api.saveScalar(prop('number'), { ...none, numericValue: '7' }));
    expect(s.form.getValues('propertyValues')).toEqual([
      {
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        propertyId: P,
        kind: 'number',
        number: '7',
      },
    ]);
  });

  it('зміна наявного скаляра лишає id', () => {
    const s = setup('product', {
      propertyValues: [{ id: O1, propertyId: P, kind: 'number', number: '1' }],
    });
    act(() => s.api.saveScalar(prop('number'), { ...none, numericValue: '2' }));
    expect(s.form.getValues('propertyValues')).toEqual([
      { id: O1, propertyId: P, kind: 'number', number: '2' },
    ]);
  });

  it('порожнє значення при наявному рядку — рядок зникає', () => {
    const s = setup('product', {
      propertyValues: [{ id: O1, propertyId: P, kind: 'number', number: '1' }],
    });
    act(() => s.api.saveScalar(prop('number'), none));
    expect(s.form.getValues('propertyValues')).toEqual([]);
  });

  it('multiselect [A] → [A, B]: додається лише B, id A той самий', () => {
    const s = setup('product', {
      propertyValues: [
        { id: MOD, propertyId: P, kind: 'multiselect', optionId: O1 },
      ],
    });
    act(() => s.api.saveMulti(prop('multiselect'), [O1, O2]));
    const rows = s.form.getValues('propertyValues');
    expect(rows.map((r) => r.optionId)).toEqual([O1, O2]);
    expect(rows[0]!.id).toBe(MOD);
  });

  it('multiselect [A, B] → [B]: A видалено, B лишився', () => {
    const s = setup('product', {
      propertyValues: [
        { id: MOD, propertyId: P, kind: 'multiselect', optionId: O1 },
        { id: P, propertyId: P, kind: 'multiselect', optionId: O2 },
      ],
    });
    act(() => s.api.saveMulti(prop('multiselect'), [O2]));
    expect(s.form.getValues('propertyValues').map((r) => r.optionId)).toEqual([
      O2,
    ]);
  });

  it('значення модифікації несе modificationId; значення товару його не має і не плутається', () => {
    const s = setup('modification', {
      propertyValues: [{ id: O1, propertyId: P, kind: 'number', number: '9' }],
    });
    act(() => s.api.saveScalar(prop('number'), { ...none, numericValue: '3' }));
    const rows = s.form.getValues('propertyValues');
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.modificationId)).toMatchObject({
      modificationId: MOD,
      number: '3',
    });
    expect(rows.find((r) => !r.modificationId)?.number).toBe('9');
    expect(s.api.rowsOf(P)).toHaveLength(1);
  });

  it('text: пише мовою активної вкладки, rowsOf віддає її текст', () => {
    const s = setup(
      'product',
      {
        propertyValues: [
          { id: O1, propertyId: P, kind: 'text', text: { uk: 'укр' } },
        ],
      },
      { active: 'en' },
    );
    expect(s.api.rowsOf(P)[0]!.value).toBeNull();
    act(() => s.api.saveScalar(prop('text'), { ...none, value: 'eng' }));
    expect(s.form.getValues('propertyValues')[0]!.text).toEqual({
      uk: 'укр',
      en: 'eng',
    });
  });

  it('зміна значення скидає серверну помилку цього поля; errors віддає помилки картки', () => {
    const clear = vi.fn();
    const s = setup(
      'product',
      {},
      { card: { valueErrors: { [P]: 'Некоректно' }, clearValueError: clear } },
    );
    expect(s.api.errors[P]).toBe('Некоректно');
    act(() => s.api.saveScalar(prop('number'), { ...none, numericValue: '1' }));
    expect(clear).toHaveBeenCalledWith(P);
  });
});
