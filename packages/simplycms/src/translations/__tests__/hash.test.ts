import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sourceFieldHash } from '../index';

describe('sourceFieldHash (§3.4: sha256 від NFC+trim)', () => {
  it('NFC і зайвий пробіл не змінюють хеш', () => {
    // Escape-послідовності, а не літерали (u+00e9 цілим символом проти «e» + u+0301):
    // редактор чи форматер міг би мовчки нормалізувати літерал і зробити тест тавтологією.
    expect(sourceFieldHash('Caf\u00e9')).toBe(sourceFieldHash('Cafe\u0301 '));
  });

  it('64 hex-символи', () => {
    expect(sourceFieldHash('Назва')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('збігається з еталонним sha256 нормалізованого тексту', () => {
    expect(sourceFieldHash('  Назва\n')).toBe(
      createHash('sha256').update('Назва', 'utf8').digest('hex'),
    );
  });

  it('різний текст — різний хеш', () => {
    expect(sourceFieldHash('Назва')).not.toBe(sourceFieldHash('Назва 2'));
  });
});
