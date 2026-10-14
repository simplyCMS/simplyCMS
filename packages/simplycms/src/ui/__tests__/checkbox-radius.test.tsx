// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { describe, expect, it, afterEach } from 'vitest';
import { Checkbox } from '../checkbox';

// Авто-cleanup RTL у репо вимкнено (globals: false) — знімаємо дерево самі.
afterEach(cleanup);

describe('Checkbox: радіус', () => {
  it('фіксований, не від --radius теми (інакше на великому радіусі це коло)', () => {
    render(<Checkbox aria-label="c" />);
    const cls = screen.getByRole('checkbox').className.split(/\s+/);

    expect(cls).toContain('rounded-[4px]');
    expect(cls).not.toContain('rounded-sm');
  });
});
