import { describe, expect, it } from 'vitest';
import { Linter } from 'eslint';
import rule from '../../eslint-rules/no-dangerously-set-inner-html.mjs';

const linter = new Linter();
const lint = (code: string) =>
  linter.verify(code, {
    plugins: { s: { rules: { 'no-dangerously-set-inner-html': rule } } },
    rules: { 's/no-dangerously-set-inner-html': 'error' },
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  });

describe('no-dangerously-set-inner-html', () => {
  it.each([
    [
      'JSX-атрибут на div',
      'const a = <div dangerouslySetInnerHTML={{ __html: x }} />;',
    ],
    [
      'JSX-атрибут на style',
      'const a = <style dangerouslySetInnerHTML={{ __html: css }} />;',
    ],
    [
      'через змінну props',
      'const p = { dangerouslySetInnerHTML: { __html: x } }; h("div", p);',
    ],
    [
      'рядковий ключ',
      'h("div", { "dangerouslySetInnerHTML": { __html: x } });',
    ],
  ])('валить: %s', (_label, code) => {
    expect(lint(code)).toHaveLength(1);
  });

  it.each([
    ['компонент RichHtml', 'const a = <RichHtml html={h} className="p" />;'],
    ['звичайний div', 'const a = <div className="p">{text}</div>;'],
    ['згадка в рядку', 'const s = "dangerouslySetInnerHTML";'],
    ['інше імʼя атрибута', 'const a = <div innerHTMLish={x} />;'],
  ])('не валить: %s', (_label, code) => {
    expect(lint(code)).toHaveLength(0);
  });
});
