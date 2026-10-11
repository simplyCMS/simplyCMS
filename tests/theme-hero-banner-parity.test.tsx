// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import type { Banner, BannerButton } from 'simplycms/contracts/objects';
import { messages as defaultMessages } from '@themes/default/messages';
import { messages as solarMessages } from '../packages/simplycms-theme-solarstore/src/messages';

/**
 * Парність HeroBanner обох тем за контрактом К3-Е6д-9: дані банера мають
 * пріоритет, інакше — тексти каталогу теми. Одні фікстури на обидві теми,
 * щоб розбіжність поведінки не могла зʼявитись у одній з них непоміченою.
 */
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    className,
  }: {
    children: ReactNode;
    to: string;
    className?: string;
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

// Транслятор каталогу теми без реєстру тем: ключ → uk-текст (або сам ключ).
let catalog: Record<string, string> = {};
vi.mock('simplycms/themes/useThemeT', () => ({
  useThemeT: () => (key: string) => catalog[key] ?? key,
}));

import { HeroBanner as DefaultHero } from '@themes/default/components/HeroBanner';
import { HeroBanner as SolarHero } from '../packages/simplycms-theme-solarstore/src/components/HeroBanner';

const button = (over: Partial<BannerButton>): BannerButton => ({
  text: 'Кнопка',
  url: '/catalog',
  target: '_self',
  variant: 'primary',
  ...over,
});

const banner = (over: Partial<Banner> = {}): Banner => ({
  id: 'b1',
  title: '',
  subtitle: null,
  image_url: '/media/b1.jpg',
  desktop_image_url: null,
  mobile_image_url: null,
  buttons: [],
  placement: 'home',
  section_id: null,
  sort_order: 0,
  is_active: true,
  date_from: null,
  date_to: null,
  schedule_days: null,
  schedule_time_from: null,
  schedule_time_to: null,
  slide_duration: 5000,
  animation_type: 'fade',
  animation_duration: 500,
  overlay_color: null,
  text_position: 'left',
  created_at: new Date(0),
  updated_at: new Date(0),
  ...over,
});

const THEMES = [
  {
    name: 'default',
    Hero: DefaultHero,
    messages: defaultMessages.uk,
    fallbackText: 'Виважений вибір',
  },
  {
    name: 'solarstore',
    Hero: SolarHero,
    messages: solarMessages.uk,
    fallbackText: 'незалежність',
  },
] as const;

afterEach(cleanup);

describe.each(THEMES)(
  'HeroBanner теми $name',
  ({ Hero, messages, fallbackText }) => {
    const setup = (banners: Banner[]) => {
      catalog = messages as Record<string, string>;
      return render(<Hero banners={banners} />);
    };

    it('показує заголовок, підзаголовок і кнопки банера', () => {
      setup([
        banner({
          title: 'Літній розпродаж',
          subtitle: 'Знижки до 40%',
          buttons: [
            button({ text: 'У каталог', url: '/catalog' }),
            button({
              text: 'Деталі',
              url: 'https://example.com/a',
              target: '_blank',
            }),
          ],
        }),
      ]);
      expect(screen.getByText('Літній розпродаж')).toBeTruthy();
      expect(screen.getByText('Знижки до 40%')).toBeTruthy();
      expect(
        screen.getByRole('link', { name: 'У каталог' }).getAttribute('href'),
      ).toBe('/catalog');
      expect(
        screen.getByRole('link', { name: 'Деталі' }).getAttribute('href'),
      ).toBe('https://example.com/a');
      expect(screen.queryByText(fallbackText, { exact: false })).toBeNull();
    });

    it('банер без заголовка й кнопок — тексти каталогу теми', () => {
      setup([banner()]);
      expect(screen.getByText(fallbackText, { exact: false })).toBeTruthy();
    });

    it('порожній масив — власний стан теми', () => {
      setup([]);
      expect(screen.getByText(fallbackText, { exact: false })).toBeTruthy();
    });

    it('кнопка з небезпечним href не рендериться посиланням', () => {
      const { container } = setup([
        banner({
          title: 'Акція',
          buttons: [
            button({ text: 'Злам', url: 'javascript:alert(1)' }),
            button({ text: 'Протокол-відносний', url: '//evil.example' }),
          ],
        }),
      ]);
      expect(screen.queryByText('Злам')).toBeNull();
      expect(screen.queryByText('Протокол-відносний')).toBeNull();
      expect(container.innerHTML).not.toContain('javascript:');
    });

    it('безпечний overlay_color потрапляє в style', () => {
      const { container } = setup([
        banner({ title: 'Акція', overlay_color: 'rgba(0, 0, 0, 0.4)' }),
      ]);
      expect(container.innerHTML).toContain('rgba(0, 0, 0, 0.4)');
    });

    it('небезпечний overlay_color не потрапляє в style', () => {
      const { container } = setup([
        banner({ title: 'Акція', overlay_color: 'red; background:url(x)' }),
      ]);
      expect(container.innerHTML).not.toContain('url(x)');
    });
  },
);
