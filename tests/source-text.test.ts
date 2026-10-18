import { describe, expect, it } from 'vitest';
import { codeOnly, stripCommentsAndStrings } from './support/source-text';

// Спільний помічник текстових гейтів (Task 17б fix-3): токени — від лексера TypeScript,
// тож `//` і `/*` поза коментарем (у вкладеному шаблоні, регекс-літералі, JSX-тексті) код не ріжуть.
const TAIL = 'const b = { images: toGallery(v) };';

describe('codeOnly / stripCommentsAndStrings', () => {
  it('(а) шаблон із вкладеним шаблоном у ${}, де є // і /*, — код після нього не зрізано', () => {
    const src = `const a = sql\`x \${f(sql\`m // n /* k\`)} y\`; ${TAIL}`;
    expect(codeOnly(src)).toBe(src);
    expect(stripCommentsAndStrings(src)).toBe(
      `const a = sql\`\${f(sql\`\`)}\`; ${TAIL}`,
    );
  });

  it('(б) регекс-літерал з // не ламає зачистку', () => {
    const src = `const r = /https?:\\/\\//; ${TAIL}`;
    expect(codeOnly(src)).toBe(src);
    expect(stripCommentsAndStrings(src)).toContain(TAIL);
  });

  it('коментарі (рядкові й блокові) прибрано, рядки не злипаються', () => {
    expect(codeOnly('a(); // b(x)\n/* c(y) */ d();')).toBe('a(); \n  d();');
    expect(codeOnly('a/* x */b')).toBe('a b');
  });

  it('рядки: codeOnly лишає вміст, stripCommentsAndStrings — лише лапки', () => {
    const src = `const u = 'https://cdn/x'; const t = "a // b";`;
    expect(codeOnly(src)).toBe(src);
    expect(stripCommentsAndStrings(src)).toBe(`const u = ''; const t = "";`);
  });

  it('JSX-текст з // у .tsx — не коментар', () => {
    const src = 'const x = <a href="//cdn">http://y // z</a>; f();';
    expect(codeOnly(src, 'view.tsx')).toBe(src);
  });
});
