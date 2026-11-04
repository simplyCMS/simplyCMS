// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ShippingSnapshotLines } from '../ShippingSnapshotLines';
import { TestI18nProvider, ukT } from '../../../test-harness/i18n';

afterEach(cleanup);

describe('ShippingSnapshotLines — знеособлена адреса (Е6г-7)', () => {
  it('city = null, address = null → «Не вказано», без «null»', () => {
    const { container } = render(
      <TestI18nProvider>
        <ShippingSnapshotLines
          shippingData={{
            methodName: 'Кур’єр',
            provider: 'core:address',
            pricing: 'rates',
            destination: { kind: 'address', city: null, address: null },
          }}
        />
      </TestI18nProvider>,
    );
    expect(screen.getByText('Кур’єр')).toBeTruthy();
    expect(screen.getByText(ukT('common.notSet'))).toBeTruthy();
    expect(container.textContent).not.toMatch(/null/);
  });
});
