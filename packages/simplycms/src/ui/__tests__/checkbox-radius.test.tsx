// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Checkbox } from '../checkbox';

describe('Checkbox: радіус', () => {
  it('фіксований, не від --radius теми (інакше на великому радіусі це коло)', () => {
    render(<Checkbox aria-label="c" />);
    const cls = screen.getByRole('checkbox').className.split(/\s+/);

    expect(cls).toContain('rounded-[4px]');
    expect(cls).not.toContain('rounded-sm');
  });
});
