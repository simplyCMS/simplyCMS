// @vitest-environment jsdom
import { render, cleanup } from '@testing-library/react';
import { describe, it, vi, afterEach } from 'vitest';
import { CheckoutContactForm } from '../CheckoutContactForm';
import { expectLabelledControls } from './accessible-controls';
import { TestI18nProvider } from '../../../test-harness/i18n';

// Авто-cleanup RTL у репо вимкнено (globals: false) — знімаємо дерево самі.
afterEach(cleanup);

describe('CheckoutContactForm', () => {
  it('чотири поля контактів мають id і label[for] — селектори live-smoke і скрінрідери', () => {
    const { container } = render(
      <TestI18nProvider>
        <CheckoutContactForm
          values={{ firstName: '', lastName: '', email: '', phone: '' }}
          onChange={vi.fn()}
        />
      </TestI18nProvider>,
    );
    expectLabelledControls(container);
  });
});
