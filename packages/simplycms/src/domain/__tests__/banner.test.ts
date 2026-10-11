import { describe, expect, it } from 'vitest';
import {
  BANNER_MAX_BUTTONS,
  BANNER_TIME_RE,
  isBannerAnimation,
  isBannerButton,
  isBannerPlacement,
  isBannerTextPosition,
  pickHeroBanner,
  pickHeroImage,
} from '../banner';
import type { Banner } from 'simplycms/contracts';

const valid = {
  text: 'До каталогу',
  url: '/catalog',
  target: '_self',
  variant: 'primary',
};

describe('isBannerButton (Е6д-13)', () => {
  it('приймає відносний шлях і http(s)-адресу', () => {
    expect(isBannerButton(valid)).toBe(true);
    expect(isBannerButton({ ...valid, url: 'https://shop.test/x' })).toBe(true);
    expect(isBannerButton({ ...valid, url: 'http://shop.test/x' })).toBe(true);
  });

  it.each([
    ['javascript:', { url: 'javascript:alert(1)' }],
    // Поліглот: `https://` усередині рядка не робить його безпечним — якір `^`
    // стоїть перед обома гілками регулярки (м2 фінального рев'ю).
    [
      'поліглот javascript:…//http://',
      { url: 'javascript:alert(1)//http://x' },
    ],
    ['протокол-відносний //', { url: '//evil.test' }],
    ['зворотний слеш після / (браузер → //)', { url: '/\\evil.test' }],
    ['без слеша', { url: 'catalog' }],
    ['url 501 символ', { url: `/${'a'.repeat(500)}` }],
    ['target поза enum', { target: '_top' }],
    ['variant поза enum', { variant: 'link' }],
    ['порожній текст', { text: '  ' }],
    ['текст 51 символ', { text: 'a'.repeat(51) }],
  ])('відхиляє: %s', (_name, patch) => {
    expect(isBannerButton({ ...valid, ...patch })).toBe(false);
  });

  it('відхиляє стару форму {label, href} і не-обʼєкти', () => {
    expect(isBannerButton({ label: 'До каталогу', href: '/catalog' })).toBe(
      false,
    );
    expect(isBannerButton(null)).toBe(false);
    expect(isBannerButton('x')).toBe(false);
  });

  it('межі: url рівно 500 і текст рівно 50 валідні', () => {
    expect(
      isBannerButton({
        ...valid,
        url: `/${'a'.repeat(499)}`,
        text: 'a'.repeat(50),
      }),
    ).toBe(true);
  });
});

describe('предикати enum і межі', () => {
  it('placement / text position / animation', () => {
    expect(isBannerPlacement('home')).toBe(true);
    expect(isBannerPlacement('footer')).toBe(false);
    expect(isBannerTextPosition('center')).toBe(true);
    expect(isBannerTextPosition('top')).toBe(false);
    expect(isBannerAnimation('fade')).toBe(true);
    expect(isBannerAnimation('spin')).toBe(false);
  });

  it('BANNER_MAX_BUTTONS = 3', () => {
    expect(BANNER_MAX_BUTTONS).toBe(3);
  });

  it('BANNER_TIME_RE: HH:MM і HH:MM:SS так, 24:00 і 9:30 ні', () => {
    expect(BANNER_TIME_RE.test('09:30')).toBe(true);
    expect(BANNER_TIME_RE.test('09:30:00')).toBe(true);
    expect(BANNER_TIME_RE.test('24:00')).toBe(false);
    expect(BANNER_TIME_RE.test('9:30')).toBe(false);
  });
});

describe('pickHeroBanner / pickHeroImage (К3-Е6д-9)', () => {
  const base = {
    id: 'b',
    title: '',
    subtitle: null,
    image_url: '',
    desktop_image_url: null,
    buttons: [],
    overlay_color: null,
    text_position: 'left',
  } as unknown as Banner;

  it('null без заголовка й валідних кнопок', () => {
    expect(pickHeroBanner([])).toBeNull();
    expect(
      pickHeroBanner([
        { ...base, buttons: [{ ...valid, url: 'javascript:x' } as never] },
      ]),
    ).toBeNull();
  });

  it('бере перший банер з текстом, кнопки фільтрує, колір — лише безпечний', () => {
    const view = pickHeroBanner([
      base,
      {
        ...base,
        title: 'Акція',
        subtitle: 'Sub',
        text_position: 'right',
        overlay_color: 'url(https://t/x)',
        buttons: [valid as never, { ...valid, url: '//evil' } as never],
      },
    ]);
    expect(view).toEqual({
      title: 'Акція',
      subtitle: 'Sub',
      buttons: [valid],
      textPosition: 'right',
      overlayColor: null,
    });
    expect(
      pickHeroBanner([{ ...base, title: 'A', overlay_color: '#000a' }])
        ?.overlayColor,
    ).toBe('#000a');
  });

  it('pickHeroImage: десктопне перед image_url, інакше null', () => {
    expect(pickHeroImage([base])).toBeNull();
    expect(
      pickHeroImage([
        base,
        { ...base, title: 'T', image_url: '/a', desktop_image_url: '/d' },
      ]),
    ).toEqual({ url: '/d', alt: 'T' });
  });
});
