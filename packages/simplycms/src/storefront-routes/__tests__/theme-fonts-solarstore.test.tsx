// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import solarstoreTheme from '@simplycms/theme-solarstore';
import { safeFontStylesheets } from 'simplycms/themes/safeFontStylesheets';
import { ThemeFonts } from '../shells/ThemeFonts';

/**
 * DB-free доказ fonts-контуру (Р9, Фаза 4 Step 4): пілот сідить `default`
 * (без `fonts`), тому єдиний спосіб довести контур без живої БД —
 * компонентний тест на РЕАЛЬНОМУ модулі `@simplycms/theme-solarstore`
 * (Р8 задекларував там `fonts` з Inter-stylesheet). Живий SSR-доказ через
 * Gate B — борг у роадмапі, поза скоупом v2.2.
 */
describe('ThemeFonts + @simplycms/theme-solarstore (реальний модуль)', () => {
  afterEach(cleanup);

  it('theme.fonts проходить safeFontStylesheets без відкидань', () => {
    const stylesheets = safeFontStylesheets(solarstoreTheme.fonts);

    expect(solarstoreTheme.fonts).toBeDefined();
    expect(stylesheets).toHaveLength(solarstoreTheme.fonts?.length ?? 0);
    expect(stylesheets).toEqual(
      solarstoreTheme.fonts?.map((f) => f.stylesheet),
    );
  });

  it('ThemeFonts рендерить <link> з href теми solarstore', () => {
    const { container } = render(<ThemeFonts fonts={solarstoreTheme.fonts} />);

    const links = container.querySelectorAll('link[rel="stylesheet"]');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe(
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    );
  });
});
