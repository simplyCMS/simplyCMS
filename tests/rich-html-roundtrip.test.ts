// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/react';
import type { Extensions } from '@tiptap/react';
import { contentEditorExtensions } from '../packages/simplycms/src/admin/components/rich-text-extensions';
import { reviewEditorExtensions } from '../packages/simplycms/src/reviews-ui/review-editor-extensions';
import { sanitizeRichHtml } from '../packages/simplycms/src/sanitize/rich-html';

/**
 * 🔴 Зворотний тест: HTML, який віддають СПРАВЖНІ Tiptap-редактори (ті самі
 * набори розширень, що в `ReviewRichTextEditor` і `RichTextEditor`), проходить
 * санітизацію без втрат — інакше санітизатор тихо ламав би форматування.
 * Порівняння канонізоване (DOM → відсортовані атрибути): sanitize-html
 * по-іншому екранує текст, пише `<br />` і стискає `style`.
 */

function canonical(html: string): string {
  const root = document.createElement('div');
  root.innerHTML = html;
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    if (!(node instanceof HTMLElement)) return '';
    const attrs = [...node.attributes]
      .map((a) => {
        const value =
          a.name === 'style'
            ? a.value.replace(/\s*([:;])\s*/g, '$1').replace(/;$/, '')
            : a.value;
        return `${a.name}="${value}"`;
      })
      .sort()
      .join(' ');
    const tag = node.tagName.toLowerCase();
    return `<${tag}${attrs ? ` ${attrs}` : ''}>${[...node.childNodes].map(walk).join('')}</${tag}>`;
  };
  return [...root.childNodes].map(walk).join('');
}

function render(extensions: Extensions, content: string) {
  const editor = new Editor({ extensions, content });
  const html = editor.getHTML();
  editor.destroy();
  return html;
}

/** Документ Tiptap (JSON) → HTML: так надійніше, ніж парсити власну розмітку. */
function renderDoc(extensions: Extensions, doc: Record<string, unknown>) {
  const editor = new Editor({ extensions, content: doc });
  const html = editor.getHTML();
  editor.destroy();
  return html;
}

const text = (value: string, marks?: { type: string; attrs?: object }[]) => ({
  type: 'text',
  text: value,
  ...(marks ? { marks } : {}),
});
const p = (...content: object[]) => ({ type: 'paragraph', content });
const li = (...content: object[]) => ({
  type: 'listItem',
  content: [p(...content)],
});

const LINK = {
  type: 'link',
  attrs: { href: 'https://shop.example/page?a=1&b=2' },
};

describe('round-trip: редактор відгуків (профіль review)', () => {
  const doc = {
    type: 'doc',
    content: [
      p(
        text('жирний', [{ type: 'bold' }]),
        text(' '),
        text('курсив', [{ type: 'italic' }]),
        text(' '),
        text('підкреслений', [{ type: 'underline' }]),
        text(' '),
        text('закреслений', [{ type: 'strike' }]),
        text(' '),
        text('код', [{ type: 'code' }]),
        { type: 'hardBreak' },
        text('посилання', [LINK]),
        text(' '),
        text('пошта', [
          { type: 'link', attrs: { href: 'mailto:a@b.example' } },
        ]),
      ),
      {
        type: 'bulletList',
        content: [li(text('один')), li(text('два', [{ type: 'bold' }]))],
      },
      {
        type: 'orderedList',
        attrs: { start: 1 },
        content: [li(text('раз')), li(text('два'))],
      },
      { type: 'orderedList', attrs: { start: 3 }, content: [li(text('три'))] },
      p(text('<script>alert(1)</script> & 5 > 3')),
      { type: 'paragraph' },
    ],
  };

  it('усі можливості редактора проходять без змін (крім примусового rel)', () => {
    const html = renderDoc(reviewEditorExtensions(), doc);
    // Страховка від вакуумного тесту: розмітка справді містить усі можливості.
    for (const tag of [
      '<strong>',
      '<em>',
      '<u>',
      '<s>',
      '<code>',
      '<br',
      '<a ',
      '<ul>',
      '<ol',
      'start="3"',
    ]) {
      expect(html).toContain(tag);
    }
    const sanitized = sanitizeRichHtml(html, 'review');
    const expected = canonical(html).replaceAll(
      'rel="noopener noreferrer nofollow"',
      'rel="nofollow ugc noopener noreferrer"',
    );
    expect(canonical(sanitized)).toBe(expected);
  });

  it('вставлений в редактор шкідливий HTML редактор і так не пропускає, санітизатор — додатково', () => {
    const html = render(
      reviewEditorExtensions(),
      '<p>ok</p><script>alert(1)</script><img src=x onerror=alert(1)>',
    );
    expect(sanitizeRichHtml(html, 'review')).toBe(html);
  });
});

describe('round-trip: редактор адмінки (профіль content)', () => {
  const heading = (level: number, textAlign: string | null, value: string) => ({
    type: 'heading',
    attrs: { level, textAlign },
    content: [text(value)],
  });
  const doc = {
    type: 'doc',
    content: [
      heading(1, null, 'Заголовок 1'),
      heading(2, 'center', 'Заголовок 2'),
      heading(3, 'right', 'Заголовок 3'),
      {
        type: 'paragraph',
        attrs: { textAlign: 'left' },
        content: [
          text('жирний', [{ type: 'bold' }]),
          text(' '),
          text('курсив', [{ type: 'italic' }]),
          text(' '),
          text('підкреслений', [{ type: 'underline' }]),
          text(' '),
          text('закреслений', [{ type: 'strike' }]),
          text(' '),
          text('код', [{ type: 'code' }]),
          { type: 'hardBreak' },
          text('зовнішнє', [LINK]),
          text(' '),
          text('внутрішнє', [{ type: 'link', attrs: { href: '/catalog' } }]),
        ],
      },
      {
        type: 'paragraph',
        attrs: { textAlign: 'center' },
        content: [text('по центру')],
      },
      {
        type: 'paragraph',
        attrs: { textAlign: 'right' },
        content: [text('праворуч')],
      },
      {
        type: 'paragraph',
        attrs: { textAlign: 'justify' },
        content: [text('по ширині')],
      },
      { type: 'bulletList', content: [li(text('один')), li(text('два'))] },
      { type: 'orderedList', attrs: { start: 1 }, content: [li(text('раз'))] },
      {
        type: 'orderedList',
        attrs: { start: 4 },
        content: [li(text('чотири'))],
      },
      { type: 'blockquote', content: [p(text('цитата'))] },
      {
        type: 'codeBlock',
        attrs: { language: null },
        content: [text('const a = 1;')],
      },
      {
        type: 'codeBlock',
        attrs: { language: 'ts' },
        content: [text('let b: number;')],
      },
      { type: 'horizontalRule' },
      {
        type: 'paragraph',
        content: [
          {
            type: 'image',
            attrs: {
              src: 'https://cdn.example/a.png',
              alt: 'опис',
              title: 'назва',
            },
          },
          {
            type: 'image',
            attrs: { src: '/media/ab/cd/photo.png', width: 300, height: 200 },
          },
        ],
      },
    ],
  };

  it('усі можливості редактора проходять без змін', () => {
    const html = renderDoc(contentEditorExtensions(), doc);
    for (const marker of [
      '<h1',
      '<h2 style="text-align: center;">',
      '<h3 style="text-align: right;">',
      'text-align: justify',
      '<strong>',
      '<em>',
      '<u>',
      '<s>',
      '<code>',
      '<br',
      '<ul>',
      'start="4"',
      '<blockquote>',
      '<pre>',
      'language-ts',
      '<hr',
      'class="max-w-full h-auto rounded-lg"',
      'src="/media/ab/cd/photo.png"',
      'href="/catalog"',
      'text-primary underline cursor-pointer',
    ]) {
      expect(html, marker).toContain(marker);
    }
    expect(canonical(sanitizeRichHtml(html, 'content'))).toBe(canonical(html));
  });
});
