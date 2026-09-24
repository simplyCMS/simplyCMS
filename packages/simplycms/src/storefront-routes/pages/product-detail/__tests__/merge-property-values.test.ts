// Е3-13: злиття рядків-на-опцію (multiselect) в один запис view-моделі.
import { describe, expect, it } from 'vitest';
import type { ProductPropertyValueViewModel } from 'simplycms/contracts/views';
import { mergePropertyValues } from '../merge-property-values';

/**
 * `name` — назва опції з живого join `property_options` (джерело правди
 * відображення); для рядка з `option_id` `value` — застарілий кеш і НЕ
 * мусить збігатися з `name`, аби тести ловили читання не з того поля.
 */
const row = (
  property_id: string,
  name: string,
  option_id: string | null = null,
  hasPage = false,
): ProductPropertyValueViewModel => ({
  property_id,
  value: option_id ? null : name,
  numeric_value: null,
  option_id,
  option: option_id ? { id: option_id, slug: option_id, name } : null,
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
    expect(out).toEqual([
      expect.objectContaining({
        option_id: 'o2',
        option: expect.objectContaining({ name: 'Білий' }),
      }),
    ]);
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

  it('назва опції — з option.name, НЕ з value (перейменована опція)', () => {
    const stale = row('color', 'НоваЧорна', 'o1');
    // Застаріле значення в `.value` — інша назва, ніж живий `option.name`.
    const withStaleValue = { ...stale, value: 'СтараНазва' };
    const [merged] = mergePropertyValues([withStaleValue], []);
    expect(merged).toMatchObject({ option: { name: 'НоваЧорна' } });
  });

  it('multiselect: один з двох рядків має value NULL (норма для option-рядка) — обидві назви в результаті', () => {
    // `a` — типовий option-рядок (`value` NULL, як пише адмінка й сід);
    // `b` — з застарілим `.value`, аби переконатись, що воно теж
    // ігнорується на користь `option.name`.
    const a = row('color', 'А', 'o1');
    expect(a.value).toBeNull();
    const b = { ...row('color', 'Б', 'o2'), value: 'СтареБ' };
    const [merged] = mergePropertyValues([a, b], []);
    expect(merged).toMatchObject({ value: 'А, Б' });
  });
});
