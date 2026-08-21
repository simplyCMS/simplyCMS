// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ThemeFonts } from '../shells/ThemeFonts';

/**
 * Рендер `<link>`-тегів із `ThemeModule.fonts` (контракт v2.2, Р5/Step 6).
 *
 * Фільтрація тут делегована `safeFontStylesheets` (юніти — у
 * `theme-system`), тому перевіряємо саме межу компонента: валідні URL
 * стають `<link>`, порожньо/відсутнє поле — нічого, битий запис відсіяно.
 */
describe('ThemeFonts', () => {
  afterEach(cleanup);

  it('рендерить <link rel="stylesheet"> для кожного валідного URL', () => {
    const { container } = render(
      <ThemeFonts
        fonts={[
          { stylesheet: 'https://fonts.googleapis.com/css2?family=Inter' },
          { stylesheet: 'https://fonts.googleapis.com/css2?family=Manrope' },
        ]}
      />,
    );

    const links = container.querySelectorAll('link[rel="stylesheet"]');
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute('href')).toBe(
      'https://fonts.googleapis.com/css2?family=Inter',
    );
    expect(links[1].getAttribute('href')).toBe(
      'https://fonts.googleapis.com/css2?family=Manrope',
    );
  });

  it('нічого не рендерить, якщо fonts відсутнє', () => {
    const { container } = render(<ThemeFonts />);
    expect(container.querySelectorAll('link')).toHaveLength(0);
  });

  it('нічого не рендерить для порожнього масиву', () => {
    const { container } = render(<ThemeFonts fonts={[]} />);
    expect(container.querySelectorAll('link')).toHaveLength(0);
  });

  it('відфільтровує битий запис (http:, не масив всередині)', () => {
    const { container } = render(
      <ThemeFonts
        fonts={[
          { stylesheet: 'http://fonts.googleapis.com/css2?family=Inter' },
          { stylesheet: 'https://fonts.googleapis.com/css2?family=Inter' },
        ]}
      />,
    );

    const links = container.querySelectorAll('link[rel="stylesheet"]');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe(
      'https://fonts.googleapis.com/css2?family=Inter',
    );
  });
});
