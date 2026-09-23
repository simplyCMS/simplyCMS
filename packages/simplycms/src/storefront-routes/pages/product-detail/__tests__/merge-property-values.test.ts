// Е3-13: злиття рядків-на-опцію (multiselect) в один запис view-моделі.
import { describe, expect, it } from 'vitest';
import type { ProductPropertyValueViewModel } from 'simplycms/contracts/views';
import { mergePropertyValues } from '../merge-property-values';

const row = (
  property_id: string,
  value: string,
  option_id: string | null = null,
  hasPage = false,
): ProductPropertyValueViewModel => ({
  property_id,
  value,
  numeric_value: null,
  option_id,
  option: option_id ? { id: option_id, slug: option_id } : null,
  property: {
    id: property_id,
    name: property_id,
    slug: property_id,
    property_type: 'multiselect',
    has_page: hasPage,
  },
});

describe('mergePropertyValues', () => {
  it('рядки однієї властивості зливаються: value через кому, option обнулено', () => {
    const out = mergePropertyValues(
      [row('color', 'Чорний', 'o1'), row('color', 'Білий', 'o2')],
      [],
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ value: 'Чорний, Білий', option_id: null });
  });

  it('модифікація ПЕРЕКРИВАЄ властивість товару цілком (правило легасі)', () => {
    const out = mergePropertyValues(
      [row('color', 'Чорний', 'o1')],
      [row('color', 'Білий', 'o2')],
    );
    expect(out).toEqual([expect.objectContaining({ value: 'Білий' })]);
  });

  it('кілька опцій із has_page: option обнулено — посилання на одну опцію не рендериться', () => {
    const [merged] = mergePropertyValues(
      [row('color', 'Чорний', 'o1', true), row('color', 'Білий', 'o2', true)],
      [],
    );
    expect(merged).toMatchObject({
      value: 'Чорний, Білий',
      option: null,
      option_id: null,
    });
  });

  it('скалярні властивості (один рядок) — без змін', () => {
    expect(mergePropertyValues([row('power', '100')], [])[0]).toMatchObject({
      value: '100',
      option_id: null,
    });
  });
});
