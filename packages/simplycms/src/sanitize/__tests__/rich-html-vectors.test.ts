import { describe, expect, it } from 'vitest';
import { sanitizeRichHtml, sanitizeNullableRichHtml } from '../rich-html';

/**
 * Вектори атаки: кожен мусить бути знешкоджений в обох профілях. Перевіряємо
 * не точний вивід, а відсутність виконуваного вмісту — тест не має ламатися від
 * зміни форми екранування.
 */
const DANGEROUS = [
  '<script>alert(1)</script>',
  '<SCRIPT SRC=//evil.example/x.js></SCRIPT>',
  '<img src=x onerror=alert(1)>',
  '<img src="https://ok.example/a.png" onerror="alert(1)">',
  '<a href="javascript:alert(1)">x</a>',
  '<a href="  javascript:alert(1)">x</a>',
  '<a href="JaVaScRiPt:alert(1)">x</a>',
  '<a href="java\tscript:alert(1)">x</a>',
  '<a href="java&#x09;script:alert(1)">x</a>',
  '<a href="&#106;avascript:alert(1)">x</a>',
  '<a href="javascript&colon;alert(1)">x</a>',
  '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>',
  '<a href="vbscript:msgbox(1)">x</a>',
  '<img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=">',
  '<img src="javascript:alert(1)">',
  '<svg onload=alert(1)></svg>',
  '<svg><script>alert(1)</script></svg>',
  '<iframe src="https://evil.example"></iframe>',
  '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  '<p style="background:url(javascript:alert(1))">x</p>',
  '<p style="text-align:center;background:url(javascript:alert(1))">x</p>',
  '<p onclick="alert(1)">x</p>',
  '<style>body{display:none}</style>',
  '<object data="x"></object><embed src="x">',
  '<form action="https://evil.example"><input name=p></form>',
  '<math><mi xlink:href="javascript:alert(1)">x</mi></math>',
  '<<script>alert(1)//<</script>',
  '<scr<script>ipt>alert(1)</scr</script>ipt>',
  '<p><b><i><a href="javascript:alert(1)">x</p></b>',
  '<a href="https://ok.example" onmouseover="alert(1)">x</a>',
  '<base href="javascript:alert(1)//">',
  '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
];

const FORBIDDEN =
  /<script|<iframe|<svg|<style|<object|<embed|<form|<input|<math|<base|<meta|onerror|onload|onclick|onmouseover|javascript:|vbscript:|data:|url\(/i;

describe.each(['review', 'content'] as const)(
  'sanitizeRichHtml (%s): вектори',
  (profile) => {
    it.each(DANGEROUS)('знешкоджує %s', (payload) => {
      const out = sanitizeRichHtml(payload, profile);
      expect(out).not.toMatch(FORBIDDEN);
    });

    it('вміст script/style не лишається навіть текстом', () => {
      expect(sanitizeRichHtml('a<script>alert(1)</script>b', profile)).toBe(
        'ab',
      );
      expect(sanitizeRichHtml('a<style>x{}</style>b', profile)).toBe('ab');
    });

    it('посилання без дозволеної схеми стає текстом', () => {
      expect(
        sanitizeRichHtml('<a href="javascript:alert(1)">x</a>', profile),
      ).toBe('x');
      expect(
        sanitizeRichHtml('<a href="//evil.example/x">x</a>', profile),
      ).toBe('x');
    });

    it('http, https і mailto дозволені', () => {
      for (const href of [
        'http://a.example/',
        'https://a.example/?q=1',
        'mailto:a@b.example',
      ]) {
        expect(sanitizeRichHtml(`<a href="${href}">x</a>`, profile)).toContain(
          `href="${href}"`,
        );
      }
    });

    it('текст із кутовими дужками екранується, а не інтерпретується', () => {
      const out = sanitizeRichHtml(
        '<p>5 &lt; 6 &amp;&amp; 7 &gt; 3</p>',
        profile,
      );
      expect(out).toBe('<p>5 &lt; 6 &amp;&amp; 7 &gt; 3</p>');
    });

    it('порожній рядок і null', () => {
      expect(sanitizeRichHtml('', profile)).toBe('');
      expect(sanitizeNullableRichHtml(null, profile)).toBeNull();
      expect(sanitizeNullableRichHtml(undefined, profile)).toBeNull();
    });
  },
);

describe('sanitizeRichHtml: профіль review', () => {
  it('посилання отримують примусовий rel і target', () => {
    const out = sanitizeRichHtml(
      '<a href="https://a.example" rel="follow" target="_self">x</a>',
      'review',
    );
    expect(out).toContain('rel="nofollow ugc noopener noreferrer"');
    expect(out).toContain('target="_blank"');
  });

  it('посилання без target/rel теж отримують їх', () => {
    const out = sanitizeRichHtml('<a href="https://a.example">x</a>', 'review');
    expect(out).toContain('rel="nofollow ugc noopener noreferrer"');
    expect(out).toContain('target="_blank"');
  });

  it('теги контенту (h1, img, blockquote, pre, hr) у відгуку не проходять', () => {
    const out = sanitizeRichHtml(
      '<h1>t</h1><blockquote>q</blockquote><pre>c</pre><hr><img src="https://a.example/a.png">',
      'review',
    );
    expect(out).toBe('tqc');
  });

  it('style і довільні класи відкидаються', () => {
    const out = sanitizeRichHtml(
      '<p style="text-align:center" class="x">a</p>',
      'review',
    );
    expect(out).toBe('<p>a</p>');
  });

  it('внутрішнє посилання у відгуку — лише текст', () => {
    expect(sanitizeRichHtml('<a href="/admin">x</a>', 'review')).toBe('x');
  });
});

describe('sanitizeRichHtml: профіль content', () => {
  it('style: лише text-align із дозволеним значенням', () => {
    expect(
      sanitizeRichHtml(
        '<p style="text-align: center; color: red">a</p>',
        'content',
      ),
    ).toBe('<p style="text-align:center">a</p>');
    expect(
      sanitizeRichHtml('<p style="text-align: evil">a</p>', 'content'),
    ).toBe('<p>a</p>');
    expect(
      sanitizeRichHtml('<span style="text-align:center">a</span>', 'content'),
    ).toBe('a');
  });

  it('img: src лише http(s) або /media/', () => {
    expect(
      sanitizeRichHtml(
        '<img src="https://a.example/a.png" alt="x">',
        'content',
      ),
    ).toContain('src="https://a.example/a.png"');
    expect(
      sanitizeRichHtml('<img src="/media/ab/cd.png">', 'content'),
    ).toContain('src="/media/ab/cd.png"');
    for (const src of [
      '//evil.example/a.png',
      '/other/a.png',
      'ftp://a.example/a.png',
      'data:image/png;base64,AAAA',
      'javascript:alert(1)',
      'x.png',
      '',
    ]) {
      expect(sanitizeRichHtml(`<img src="${src}">`, 'content')).toBe('');
    }
  });

  it('внутрішнє посилання зі слешем дозволене, протокол-відносне — ні', () => {
    expect(sanitizeRichHtml('<a href="/catalog">x</a>', 'content')).toContain(
      'href="/catalog"',
    );
    expect(sanitizeRichHtml('<a href="//evil.example">x</a>', 'content')).toBe(
      'x',
    );
  });

  it('rel: чужі токени відкидаються, noopener/noreferrer дописуються', () => {
    const out = sanitizeRichHtml(
      '<a href="https://a.example" target="_blank" rel="opener nofollow">x</a>',
      'content',
    );
    expect(out).toContain('rel="nofollow noopener noreferrer"');
  });

  it('сторонні класи відкидаються, класи редактора лишаються', () => {
    const out = sanitizeRichHtml(
      '<a href="https://a.example" class="text-primary evil underline">x</a>',
      'content',
    );
    expect(out).toContain('class="text-primary underline"');
    expect(out).not.toContain('evil');
  });

  it('старі теги b/i/strike зводяться до розмітки редактора', () => {
    expect(
      sanitizeRichHtml('<b>a</b><i>b</i><strike>c</strike>', 'content'),
    ).toBe('<strong>a</strong><em>b</em><s>c</s>');
  });
});
