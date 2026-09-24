// @vitest-environment jsdom
// Е3-13 (ревізія «назва опції — одне джерело»): відображення значення
// характеристики з option_id бере `option.name`, а не застарілий `value`.

import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { I18nProvider } from 'simplycms/i18n';
import { ProductCharacteristics } from '../ProductCharacteristics';

afterEach(() => cleanup());

function withI18n(children: ReactNode) {
  return <I18nProvider locale="uk">{children}</I18nProvider>;
}

describe('ProductCharacteristics', () => {
  it('option_id з value NULL — показує назву опції, рядок не зникає з фільтра', () => {
    render(
      withI18n(
        <ProductCharacteristics
          propertyValues={[
            {
              property_id: 'p1',
              value: null,
              numeric_value: null,
              option_id: 'o1',
              option: { id: 'o1', slug: 'chornyi', name: 'Чорний' },
              property: {
                id: 'p1',
                name: 'Колір',
                slug: 'color',
                property_type: 'select',
                has_page: false,
              },
            },
          ]}
        />,
      ),
    );
    expect(screen.getByText('Чорний')).toBeTruthy();
    expect(screen.getByText('Колір')).toBeTruthy();
  });

  it('перейменована опція (option.name новий, value старий) — показує нову назву', () => {
    render(
      withI18n(
        <ProductCharacteristics
          propertyValues={[
            {
              property_id: 'p1',
              value: 'СтараНазва',
              numeric_value: null,
              option_id: 'o1',
              option: { id: 'o1', slug: 'chornyi', name: 'НоваНазва' },
              property: {
                id: 'p1',
                name: 'Колір',
                slug: 'color',
                property_type: 'select',
                has_page: false,
              },
            },
          ]}
        />,
      ),
    );
    expect(screen.getByText('НоваНазва')).toBeTruthy();
    expect(screen.queryByText('СтараНазва')).toBeNull();
  });

  it('скалярна властивість (без option) — значення й далі з value', () => {
    render(
      withI18n(
        <ProductCharacteristics
          propertyValues={[
            {
              property_id: 'p1',
              value: 'Бавовна 100%',
              numeric_value: null,
              option_id: null,
              option: null,
              property: {
                id: 'p1',
                name: 'Матеріал',
                slug: 'material',
                property_type: 'text',
                has_page: false,
              },
            },
          ]}
        />,
      ),
    );
    expect(screen.getByText('Бавовна 100%')).toBeTruthy();
  });
});
