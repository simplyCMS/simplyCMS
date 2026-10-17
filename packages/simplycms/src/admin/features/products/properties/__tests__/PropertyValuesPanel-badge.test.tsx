// @vitest-environment jsdom
// Бейдж статусу тексту значення властивості: лише для текстової властивості
// не-основної мови, коли значення збережене й переклад не актуальний.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CardHarness } from '../../__tests__/card-harness';

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({}),
);
vi.mock('../usePropertySchema', () => ({
  usePropertySchema: () => ({
    isLoading: false,
    rows: [
      {
        assignment: { appliesTo: 'product' },
        property: {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Матеріал',
          propertyType: 'text',
          isRequired: false,
        },
        options: [],
      },
    ],
  }),
}));

import { PropertyValuesPanel } from '../PropertyValuesPanel';

afterEach(() => cleanup());
const VAL = '11111111-1111-4111-8111-111111111111';
const values = {
  propertyValues: [
    {
      id: VAL,
      propertyId: '22222222-2222-4222-8222-222222222222',
      kind: 'text' as const,
      text: { uk: 'мідь', en: 'copper' },
    },
  ],
};
const panel = (active: string, status: 'outdated' | 'current') =>
  render(
    <CardHarness
      values={values}
      active={active}
      card={{ statusOfValueText: () => status }}
    >
      <PropertyValuesPanel
        target="product"
        ownerId="p"
        sectionId="s"
        appliesTo="product"
      />
    </CardHarness>,
  );

describe('PropertyValuesPanel: бейдж статусу тексту', () => {
  it('застарілий переклад на en показано', () => {
    panel('en', 'outdated');
    expect(screen.getByText('Застарілий')).toBeTruthy();
  });
  it('на основній мові бейджа немає, актуальний переклад — теж', () => {
    panel('uk', 'outdated');
    expect(screen.queryByText('Застарілий')).toBeNull();
    cleanup();
    panel('en', 'current');
    expect(screen.queryByText('Застарілий')).toBeNull();
  });
});
