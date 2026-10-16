import sanitizeHtml from 'sanitize-html';
import { describe, expect, it } from 'vitest';
import { hasRichText } from 'simplycms/domain/translations';
import { sanitizeRichHtml } from '../rich-html';
import { DANGEROUS } from './rich-html-vectors.data';

// Два розбори HTML (токенайзер `hasRichText` і sanitize-html) не мають розійтися
// непомітно: вердикт «є вміст» на ВЖЕ санітизованому виводі звіряється з
// незалежним оракулом на самому sanitize-html (текст без тегів + медіа-теги).
const EXTRA = [
  '',
  '<p></p>',
  '<p>&nbsp;</p>',
  '<p title="a>b"></p>',
  '<p>&lt;img&gt;</p>',
  '<p><img src="https://ok.example/a.png" alt="a>b"></p>',
  '<p>&#00160;&ensp;</p>',
  '<p>текст</p>',
  '<p>​</p>',
];

/** Оракул: медіа лишилось у виводі санітайзера, або зі зняттям тегів є не-порожній текст. */
function oracle(clean: string): boolean {
  const media = /<(?:img|video|iframe)[\s/>]/i.test(clean);
  const text = sanitizeHtml(clean, { allowedTags: [], allowedAttributes: {} })
    .replace(/&(?:nbsp|ensp|emsp|thinsp|#0*160|#x0*a0|#0*8203|#x0*200b);/gi, '')
    .replace(/[\s​-‍⁠﻿]+/g, '');
  return media || text !== '';
}

describe.each(['review', 'content'] as const)(
  'hasRichText проти санітайзера (%s)',
  (profile) => {
    it.each([...DANGEROUS, ...EXTRA])('вектор %j', (payload) => {
      const clean = sanitizeRichHtml(payload, profile);
      expect(hasRichText(clean)).toBe(oracle(clean));
    });
  },
);
