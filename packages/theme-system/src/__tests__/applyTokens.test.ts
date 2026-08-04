import { describe, expect, it } from 'vitest';
import { applyTokens } from '../applyTokens';

describe('applyTokens', () => {
  it('пише значення в НАЯВНУ semantic-змінну shadcn', () => {
    const css = applyTokens({ primary: '221 83% 53%' });

    expect(css).toContain('--primary: 221 83% 53%');
    // Нових `--color-*` не вводимо
    expect(css).not.toContain('--color-');
  });

  it('обгортає токени в :root-блок', () => {
    const css = applyTokens({ background: '30 33% 93%' });

    expect(css).toMatch(/^:root\s*\{/);
    expect(css.trim().endsWith('}')).toBe(true);
  });

  it('підтримує дефісні ключі та radius', () => {
    const css = applyTokens({
      'primary-foreground': '0 0% 100%',
      radius: '0.375rem',
    });

    expect(css).toContain('--primary-foreground: 0 0% 100%');
    expect(css).toContain('--radius: 0.375rem');
  });

  it('виносить dark-перекриття в окремий .dark-блок', () => {
    const css = applyTokens({
      primary: '203 85% 47%',
      dark: { primary: '203 85% 55%' },
    });

    expect(css).toContain(':root');
    expect(css).toContain('.dark');
    expect(css.indexOf('.dark')).toBeGreaterThan(css.indexOf(':root'));
    expect(css).toContain('--primary: 203 85% 55%');
    // `dark` — не CSS-змінна
    expect(css).not.toContain('--dark:');
  });

  it('повертає порожній рядок для порожніх токенів', () => {
    expect(applyTokens({})).toBe('');
  });

  it('відкидає значення, які ламають CSS-блок (захист від інʼєкції)', () => {
    const css = applyTokens({
      primary: '221 83% 53%',
      background: '0 0% 0%; } body { display: none',
    });

    expect(css).toContain('--primary: 221 83% 53%');
    expect(css).not.toContain('display: none');
  });
});
