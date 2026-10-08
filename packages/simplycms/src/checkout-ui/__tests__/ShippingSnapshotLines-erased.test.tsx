// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createTranslator, I18nProvider } from 'simplycms/i18n';
import { ShippingSnapshotLines } from '../ShippingSnapshotLines';

afterEach(cleanup);

describe('ShippingSnapshotLines — знеособлена адреса (Е6г-7)', () => {
  it('city = null, address = null → «Не вказано», без «null»', () => {
    const { container } = render(
      <I18nProvider locale="uk">
        <ShippingSnapshotLines
          shippingData={{
            methodName: 'Кур’єр',
            provider: 'core:address',
            pricing: 'rates',
            destination: { kind: 'address', city: null, address: null },
          }}
        />
      </I18nProvider>,
    );
    expect(screen.getByText('Кур’єр')).toBeTruthy();
    expect(
      screen.getByText(createTranslator('uk')('common.notSet')),
    ).toBeTruthy();
    expect(container.textContent).not.toMatch(/null/);
  });
});
