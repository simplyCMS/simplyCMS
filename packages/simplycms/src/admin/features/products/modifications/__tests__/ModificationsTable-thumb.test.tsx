// @vitest-environment jsdom
// Мініатюра рядка реагує на зміну фото в ЧЕРНЕТЦІ картки (useWatch), а не
// лише на перемальовування таблиці з інших причин.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import type { UseFormReturn } from 'react-hook-form';
import type { ProductFormValues } from '../../edit/product-form-schema';
import { ResizeObserverStub } from '../../edit/__tests__/test-engine-stub';
import { CardHarness, mod, PRODUCT_ID } from '../../__tests__/card-harness';

vi.stubGlobal('ResizeObserver', ResizeObserverStub);
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({}),
);

import { ModificationsPanel } from '../ModificationsPanel';

afterEach(() => cleanup());
const A = '11111111-1111-4111-8111-aaaaaaaaaaaa';

describe('ModificationsTable: мініатюра', () => {
  it('додане в чернетку фото модифікації з’являється в рядку без іншої зміни', () => {
    let form!: UseFormReturn<ProductFormValues>;
    const { container } = render(
      <CardHarness
        values={{ modifications: [mod(A, 'М')] }}
        onForm={(f) => (form = f)}
      >
        <ModificationsPanel productId={PRODUCT_ID} sectionId={null} />
      </CardHarness>,
    );
    expect(container.querySelector('tbody img')).toBeNull();
    act(() =>
      form.setValue('images', [
        {
          id: A,
          storageKey: 'product/a.png',
          sortOrder: 0,
          modificationId: A,
          alt: {},
          overrides: {},
        },
      ]),
    );
    expect(container.querySelector('tbody img')).not.toBeNull();
  });
});
