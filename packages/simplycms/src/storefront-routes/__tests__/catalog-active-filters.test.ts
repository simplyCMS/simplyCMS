import { describe, it, expect } from 'vitest';
import { createTranslator } from 'simplycms/i18n';
import {
  buildActiveFilterChips,
  type ChipSources,
} from '../pages/catalog/active-filter-chips';
import type { NumericProperty } from '../pages/catalog/types';

/**
 * Бейджі активних фільтрів — спільні для каталогу й сторінки розділу
 * (Фаза 4). Під тестом склад бейджів, а не їх оформлення.
 */
const t = createTranslator('uk');

const power: NumericProperty = {
  id: 'prop-power',
  slug: 'power',
  property_type: 'number',
  is_filterable: true,
};

const sources: ChipSources = {
  priceRange: { min: 100, max: 900 },
  numericRanges: { power: { min: 300, max: 700 } },
  numericProperties: [power],
  propertyOptions: [
    {
      id: 'opt-1',
      name: 'Синій',
      section_properties: { name: 'Колір', slug: 'color' },
    },
  ],
};

describe('buildActiveFilterChips', () => {
  it('порожній стан фільтрів — жодного бейджа', () => {
    expect(buildActiveFilterChips({}, t, sources)).toEqual([]);
  });

  it('ціна: пропущена межа береться з меж вибірки', () => {
    const chips = buildActiveFilterChips({ priceMin: 200 }, t, sources);

    expect(chips).toHaveLength(1);
    expect(chips[0].type).toBe('price');
    expect(chips[0].value).toBe('200 - 900 ₴');
  });

  it('пара Min/Max числової характеристики дає ОДИН бейдж-діапазон', () => {
    const chips = buildActiveFilterChips(
      { powerMin: 400, powerMax: 500 },
      t,
      sources,
    );

    expect(chips).toHaveLength(1);
    expect(chips[0]).toMatchObject({
      key: 'power',
      type: 'range',
      value: '400 - 500',
    });
  });

  it('опція: підпис — назва групи характеристик, значення — назва опції', () => {
    const chips = buildActiveFilterChips({ color: ['opt-1'] }, t, sources);

    expect(chips).toEqual([
      {
        key: 'color',
        label: 'Колір',
        value: 'Синій',
        type: 'option',
        optionId: 'opt-1',
      },
    ]);
  });

  it('невідома опція бейджа не дає', () => {
    expect(buildActiveFilterChips({ color: ['ghost'] }, t, sources)).toEqual(
      [],
    );
  });

  it('boolean-фільтр дає бейдж «назва: Так» з типом boolean', () => {
    const chips = buildActiveFilterChips({ 'has-wifi': true }, t, {
      ...sources,
      booleanProperties: [{ id: 'pB', slug: 'has-wifi', name: 'Wi-Fi' }],
    });

    expect(chips).toEqual([
      { key: 'has-wifi', label: 'Wi-Fi', value: 'Так', type: 'boolean' },
    ]);
  });

  it('знятий boolean-фільтр (undefined) бейджа не дає', () => {
    const chips = buildActiveFilterChips({ 'has-wifi': undefined }, t, {
      ...sources,
      booleanProperties: [{ id: 'pB', slug: 'has-wifi', name: 'Wi-Fi' }],
    });

    expect(chips).toEqual([]);
  });
});
