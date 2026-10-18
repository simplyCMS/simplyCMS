import { describe, expect, it } from 'vitest';
import {
  codeOnly,
  maskKeepingOffsets,
  stripCommentsAndStrings,
} from './support/source-text';

// Спільний помічник текстових гейтів (Task 17б fix-3): токени — від лексера TypeScript,
// тож `//` і `/*` поза коментарем (у вкладеному шаблоні, регекс-літералі, JSX-тексті) код не ріжуть.
const TAIL = 'const b = { images: toGallery(v) };';

describe('codeOnly / stripCommentsAndStrings', () => {
  it('(а) шаблон із вкладеним шаблоном у ${}, де є // і /*, — код після нього не зрізано', () => {
    const src = `const a = sql\`x \${f(sql\`m // n /* k\`)} y\`; ${TAIL}`;
    expect(codeOnly(src, 'a.ts')).toBe(src);
    expect(stripCommentsAndStrings(src, 'a.ts')).toBe(
      `const a = sql\`\${f(sql\`\`)}\`; ${TAIL}`,
    );
  });

  it('(б) регекс-літерал з // не ламає зачистку', () => {
    const src = `const r = /https?:\\/\\//; ${TAIL}`;
    expect(codeOnly(src, 'a.ts')).toBe(src);
    expect(stripCommentsAndStrings(src, 'a.ts')).toContain(TAIL);
  });

  it('коментарі (рядкові й блокові) прибрано, рядки не злипаються', () => {
    expect(codeOnly('a(); // b(x)\n/* c(y) */ d();', 'a.ts')).toBe(
      'a(); \n  d();',
    );
    expect(codeOnly('a/* x */b', 'a.ts')).toBe('a b');
  });

  it('рядки: codeOnly лишає вміст, stripCommentsAndStrings — лише лапки', () => {
    const src = `const u = 'https://cdn/x'; const t = "a // b";`;
    expect(codeOnly(src, 'a.ts')).toBe(src);
    expect(stripCommentsAndStrings(src, 'a.ts')).toBe(
      `const u = ''; const t = "";`,
    );
  });

  it('JSX-текст з // у .tsx — не коментар', () => {
    const src = 'const x = <a href="//cdn">http://y // z</a>; f();';
    expect(codeOnly(src, 'view.tsx')).toBe(src);
  });

  it('🔴 невідоме розширення — помилка, а не мовчки TS', () => {
    expect(() => codeOnly('f();', 'notes.txt')).toThrow(/невідоме розширення/);
    expect(() => stripCommentsAndStrings('f();', 'no-extension')).toThrow(
      /невідоме розширення/,
    );
  });

  it('🔴 той самий JSX-текст з // зрізав би код без імені .tsx — тому ім’я обов’язкове', () => {
    // Негативний контроль: під .ts лексер бачить `//` як коментар і ріже `f();` —
    // саме цей хибно-зелений вердикт обов'язковий fileName унеможливлює.
    const src = 'const x = <a>http://y // z</a>; f();';
    expect(codeOnly(src, 'view.tsx')).toContain('f();');
    expect(codeOnly(src, 'view.ts')).not.toContain('f();');
  });

  it('SQL: -- і /* */ — коментарі, -- у рядку — ні; тіла $$ — код', () => {
    const src =
      "select '--x' as a; -- live_fn()\n/* ghost_fn() */ create function real_fn() returns int as $$ select 1 $$;";
    const out = codeOnly(src, 'm.sql');
    expect(out).toContain("'--x'");
    expect(out).not.toContain('live_fn');
    expect(out).not.toContain('ghost_fn');
    expect(out).toContain('create function real_fn()');
    expect(out).toContain('$$ select 1 $$');
    expect(stripCommentsAndStrings("select 'it''s'", 'm.sql')).toBe(
      "select ''",
    );
  });

  it('CSS: /* */ — коментар, рядки за правилами CSS', () => {
    const src = '.a { content: "/* x */"; } /* .ghost {} */ .b {}';
    expect(codeOnly(src, 's.css')).toBe('.a { content: "/* x */"; }   .b {}');
  });
});

describe('maskKeepingOffsets (зсуви збережено)', () => {
  it('вкладений шаблон з // і /* — довжина та сама, код після нього живий, дужки в рядках зникли', () => {
    const src = `const a = sql\`x(\${f(sql\`m // n /* k)\`)} y\`; // (\n${TAIL}`;
    const masked = maskKeepingOffsets(src, 'a.mjs', true);
    expect(masked).toHaveLength(src.length);
    expect(masked.endsWith(TAIL)).toBe(true);
    // Дужки лишились лише кодові: виклики f(...) і toGallery(...) з TAIL.
    expect(masked.match(/\(/g)).toHaveLength(2);
  });

  it('без strings — лише коментарі стають пробілами, рядок лишається', () => {
    const src = "q('a // b'); // c(\n/* d( */ e();";
    const text = maskKeepingOffsets(src, 'a.mjs', false);
    expect(text).toHaveLength(src.length);
    expect(text).toContain("q('a // b');");
    expect(text).not.toContain('c(');
    expect(text).not.toContain('d(');
    expect(text.split('\n')).toHaveLength(src.split('\n').length);
  });
});
