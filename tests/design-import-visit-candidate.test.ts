/**
 * Юніти `lib/visit-candidate.mjs` (інкремент Б.3, фікси рев'ю). Браузер не
 * потрібен: `page` тут — фейк із рівно тими чотирма методами, які кличуть
 * `visitCandidate` і `scrollThrough`. Саме заради цього візит і винесено з
 * `discover.mjs` окремим модулем.
 *
 * 🔴 Головне, що доводиться тут, — дефект 4 рев'ю: помилка КОНТЕНТ-ПРОБА не
 * має перетворювати чесний 2xx на `visit-failed`. Раніше проб стояв усередині
 * спільного `try`, і будь-який CSP/detached frame/таймаут `evaluate` робив
 * існуючу сторінку «неіснуючою».
 */
import { describe, expect, it } from 'vitest';
import {
  PROBED_TYPES,
  visitCandidate,
} from '../.agents/skills/redesign-from-reference/scripts/lib/visit-candidate.mjs';

const PROBE_RESULT = { jsonLdTypes: ['Product'], cardLinks: 0 };
/** Маркер-функція проба: фейк упізнає її за посиланням, а не за вмістом. */
const probeFn = () => PROBE_RESULT;

/**
 * Фейк сторінки. `evaluate` віддає канонічні відповіді `scrollThrough`
 * (висота/viewport), а на самій `probeFn` — те, що просить тест.
 */
function fakePage({
  status = 200,
  gotoError = null as Error | null,
  probe = 'ok' as 'ok' | 'throws',
  scroll = 'ok' as 'ok' | 'throws',
}) {
  const evaluated: string[] = [];
  return {
    evaluated,
    page: {
      async goto() {
        if (gotoError) throw gotoError;
        return status ? { ok: () => status < 400 } : null;
      },
      async title() {
        return 'Fixture title';
      },
      async waitForTimeout() {},
      async evaluate(fn: unknown) {
        if (fn === probeFn) {
          evaluated.push('probe');
          if (probe === 'throws')
            throw new Error('Execution context destroyed');
          return PROBE_RESULT;
        }
        evaluated.push('scroll');
        if (scroll === 'throws') throw new Error('CSP blocked evaluation');
        return { scrollHeight: 1000, viewportHeight: 1000 };
      },
    },
  };
}

describe('lib/visit-candidate.mjs — visitCandidate', () => {
  it('2xx + проб: повертає title і probe, а скрол іде ПЕРЕД пробом', async () => {
    // 🔴 Дефект 3: сітку карток масово дорендеровують на скролі, тож проб,
    // знятий одразу після `goto`, побачив би нуль карток на живому каталозі.
    const { page, evaluated } = fakePage({});
    const result = await visitCandidate(
      page,
      'https://a.com/shop',
      'listing',
      probeFn,
    );

    expect(result).toEqual({
      ok: true,
      title: 'Fixture title',
      probe: PROBE_RESULT,
    });
    expect(evaluated[0]).toBe('scroll');
    expect(evaluated.at(-1)).toBe('probe');
  });

  it('падіння проба лишає візит успішним — просто БЕЗ probe', async () => {
    const { page } = fakePage({ probe: 'throws' });
    const result = await visitCandidate(
      page,
      'https://a.com/shop',
      'listing',
      probeFn,
    );

    expect(result).toEqual({ ok: true, title: 'Fixture title' });
    // Відсутній проб має документовану семантику «не доказ невідповідності»
    // (`detectVisitMismatch` → false), тож деградація чесна, а не мовчазна.
    expect(result).not.toHaveProperty('probe');
  });

  it('падіння скролу так само не валить візит', async () => {
    const { page } = fakePage({ scroll: 'throws' });
    const result = await visitCandidate(
      page,
      'https://a.com/shop',
      'product',
      probeFn,
    );

    expect(result).toEqual({ ok: true, title: 'Fixture title' });
  });

  it('не-2xx і помилка переходу — це справжній visit-failed', async () => {
    const notFound = fakePage({ status: 404 });
    expect(
      await visitCandidate(
        notFound.page,
        'https://a.com/gone',
        'listing',
        probeFn,
      ),
    ).toEqual({ ok: false });

    const offline = fakePage({ gotoError: new Error('net::ERR_ABORTED') });
    expect(
      await visitCandidate(
        offline.page,
        'https://a.com/gone',
        'listing',
        probeFn,
      ),
    ).toEqual({ ok: false });
    // Проб на провальному візиті не знімається взагалі.
    expect(offline.evaluated).toEqual([]);
  });

  it('неперевірюваний тип: ні скролу, ні проба — сторінці вірять на слово', async () => {
    const { page, evaluated } = fakePage({});
    const result = await visitCandidate(
      page,
      'https://a.com/cart',
      'cart',
      probeFn,
    );

    expect(result).toEqual({ ok: true, title: 'Fixture title' });
    expect(evaluated).toEqual([]);
    expect([...PROBED_TYPES]).toEqual(['listing', 'product']);
  });
});
