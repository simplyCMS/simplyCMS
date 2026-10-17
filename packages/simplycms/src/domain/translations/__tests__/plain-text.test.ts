import { describe, expect, it } from 'vitest';
import { richTextToPlain } from '../plain-text';

describe('richTextToPlain', () => {
  it('знімає теги, лишає текст', () => {
    expect(richTextToPlain('<p>Опис <b>x</b></p>')).toBe('Опис x');
  });

  it('абзаци й <br> розділяються пробілом, а не склеюються', () => {
    expect(richTextToPlain('<p>a</p><p>b</p>a<br>c')).toBe('a b a c');
  });

  it('медіа не обриває витяг тексту', () => {
    expect(richTextToPlain('<p>до</p><img src="a.png"><p>після</p>')).toBe(
      'до після',
    );
  });

  it('сутності: базові розкриваються, nbsp стає пробілом', () => {
    expect(richTextToPlain('<p>Tom &amp; Jerry&nbsp;&lt;3 &#33;</p>')).toBe(
      'Tom & Jerry <3 !',
    );
  });

  it('> усередині значення атрибута не обриває тег', () => {
    expect(richTextToPlain('<p title="a>b">текст</p>')).toBe('текст');
  });

  it('порожня розмітка → порожній рядок', () => {
    expect(richTextToPlain('<p></p>')).toBe('');
  });
});
