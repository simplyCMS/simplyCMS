// @vitest-environment jsdom
/**
 * `NumberPropertyInput` (Е3-19а) — збереження на blur/Enter, НЕ на кожну
 * клавішу: набір "15" з write-back "1.0000" ПОСЕРЕД набору (поле у
 * фокусі) не повинен переписати чернетку; розмонтування з незбереженою
 * чернеткою — flush у cleanup; blur без змін — жодної мутації.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NumberPropertyInput } from '../NumberPropertyInput';

afterEach(() => cleanup());

describe('NumberPropertyInput: чернетка + blur/Enter (Е3-19а)', () => {
  it('write-back посеред набору (поле у фокусі) не переписує чернетку; save на blur — раз', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <NumberPropertyInput id="x" value="1.0000" onChange={onChange} />,
    );
    const input = screen.getByRole('spinbutton') as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '1' } });
    // Write-back із колекції посеред набору — той самий рендер-шлях, що
    // після persist фабричного update; поле у фокусі має його ІГНОРУВАТИ.
    rerender(<NumberPropertyInput id="x" value="9.0000" onChange={onChange} />);
    expect(input.value).toBe('1'); // не "9" — write-back не переписав чернетку
    fireEvent.change(input, { target: { value: '15' } });
    expect(input.value).toBe('15');
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      value: '15',
      numericValue: '15',
      optionId: null,
    });
  });

  it('Enter — теж flush; після write-back того самого значення наступний blur мовчить', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <NumberPropertyInput id="x" value="" onChange={onChange} />,
    );
    const input = screen.getByRole('spinbutton') as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '7' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      value: '7',
      numericValue: '7',
      optionId: null,
    });

    // Write-back підтверджує щойно збережене значення — той самий round
    // trip, що фабричний update.
    rerender(<NumberPropertyInput id="x" value="7" onChange={onChange} />);
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledTimes(1); // без змін — нуль додаткових
  });

  it('розмонтування з незбереженою чернеткою — одна мутація (flush у cleanup)', () => {
    const onChange = vi.fn();
    const { unmount } = render(
      <NumberPropertyInput id="x" value="1.0000" onChange={onChange} />,
    );
    const input = screen.getByRole('spinbutton') as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '42' } });
    expect(onChange).not.toHaveBeenCalled();

    unmount();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      value: '42',
      numericValue: '42',
      optionId: null,
    });
  });

  it('blur без змін — жодної мутації', () => {
    const onChange = vi.fn();
    render(<NumberPropertyInput id="x" value="5" onChange={onChange} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });
});
