// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, it, vi } from 'vitest';
import { I18nProvider } from 'simplycms/i18n';
import { CheckoutContactForm } from '../CheckoutContactForm';
import { expectLabelledControls } from './accessible-controls';

describe('CheckoutContactForm', () => {
  it('чотири поля контактів мають id і label[for] — селектори live-smoke і скрінрідери', () => {
    const { container } = render(
      <I18nProvider locale="uk">
        <CheckoutContactForm
          values={{ firstName: '', lastName: '', email: '', phone: '' }}
          onChange={vi.fn()}
        />
      </I18nProvider>,
    );
    expectLabelledControls(container);
  });
});
