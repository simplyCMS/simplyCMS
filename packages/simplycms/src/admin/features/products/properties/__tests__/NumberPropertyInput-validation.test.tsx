// @vitest-environment jsdom
/**
 * Тема 12: числове поле властивості (`numeric(15, 4)`) — клієнт не шле більше
 * знаків, ніж колонка, і ніколи не шле експоненту; помилка сервера показується
 * біля поля.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from 'simplycms/i18n';
import { NumberPropertyInput } from '../NumberPropertyInput';

afterEach(() => cleanup());

function setup(props: { value?: string | null; error?: string } = {}) {
  const onChange = vi.fn();
  render(
    <I18nProvider locale="uk">
      <NumberPropertyInput
        id="n"
        value={props.value ?? null}
        error={props.error}
        onChange={onChange}
      />
    </I18nProvider>,
  );
  return {
    onChange,
    input: screen.getByRole('spinbutton') as HTMLInputElement,
  };
}

describe('NumberPropertyInput: формат numeric(15,4)', () => {
  it('0.00001 → локалізована помилка біля поля, збереження заблоковане', async () => {
    const { onChange, input } = setup();
    const user = userEvent.setup();
    await user.type(input, '0.00001');
    expect(
      screen.getByText('Введіть число: до 15 цифр, із них 4 після коми'),
    ).toBeTruthy();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    await user.tab();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('1e-7 не відправляється як експонента (і не вміщається — блок)', async () => {
    const { onChange, input } = setup();
    const user = userEvent.setup();
    await user.type(input, '1e-7');
    await user.tab();
    expect(onChange).not.toHaveBeenCalled();
    expect(
      screen.getByText('Введіть число: до 15 цифр, із них 4 після коми'),
    ).toBeTruthy();
  });

  it('1e2 → відправляється простим рядком "100", без експоненти', async () => {
    const { onChange, input } = setup();
    const user = userEvent.setup();
    await user.type(input, '1e2');
    await user.tab();
    expect(onChange).toHaveBeenCalledWith({
      value: '100',
      numericValue: '100',
      optionId: null,
    });
  });

  it('1.5000 (хвостові нулі) → "1.5"; 0.0001 — на межі scale, проходить', async () => {
    const a = setup();
    const user = userEvent.setup();
    await user.type(a.input, '1.5000');
    await user.tab();
    expect(a.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ numericValue: '1.5' }),
    );
    cleanup();
    const b = setup();
    await user.type(b.input, '0.0001');
    await user.tab();
    expect(b.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ numericValue: '0.0001' }),
    );
  });

  it('помилка сервера (проп error) показується під полем', () => {
    setup({ error: 'Некоректне значення' });
    const msg = screen.getByText('Некоректне значення');
    expect(msg.id).toBe('n-error');
  });
});
