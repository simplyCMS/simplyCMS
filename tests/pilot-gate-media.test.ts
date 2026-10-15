import { describe, expect, it } from 'vitest';
import { parseReport } from '../scripts/pilot-pack/store-child.mjs';

/**
 * Чиста частина `gate-media`/`gate-mail`: розбір виводу дочірнього процесу.
 * Гейт вірить лише ОСТАННЬОМУ рядку з тегом — усе інше (шум залежностей, стек)
 * для вердикту не існує, а зіпсований чи відсутній звіт дає `null` (червоне).
 */
describe('parseReport', () => {
  it('бере останній рядок із тегом і ігнорує шум навколо', () => {
    const out = [
      'warning: щось з залежності',
      'GATE_MEDIA {"key":"ab/x.png","same":false}',
      'GATE_MEDIA {"key":"cd/y.png","same":true}',
      'GATE_MEDIA_X {"key":"інший тег"}',
      '',
    ].join('\n');
    expect(parseReport(out, 'GATE_MEDIA')).toEqual({
      key: 'cd/y.png',
      same: true,
    });
  });

  it('немає рядка з тегом — null', () => {
    expect(parseReport('просто шум\n', 'GATE_MEDIA')).toBeNull();
    expect(parseReport('', 'GATE_MEDIA')).toBeNull();
  });

  it('зіпсований json або не обʼєкт — null, а не виняток', () => {
    expect(parseReport('GATE_MEDIA {не json', 'GATE_MEDIA')).toBeNull();
    expect(parseReport('GATE_MEDIA 42', 'GATE_MEDIA')).toBeNull();
    expect(parseReport('GATE_MEDIA null', 'GATE_MEDIA')).toBeNull();
  });

  it('тег — лише префікс рядка, не підрядок у середині', () => {
    expect(parseReport('x GATE_MEDIA {"a":1}', 'GATE_MEDIA')).toBeNull();
  });
});
