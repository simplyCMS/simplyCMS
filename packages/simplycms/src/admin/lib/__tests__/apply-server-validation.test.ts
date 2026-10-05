import { describe, expect, it, vi } from 'vitest';
import { VALIDATION_ISSUE_CODES } from 'simplycms/contracts/domain-errors';
import { createTranslator } from 'simplycms/i18n';
import {
  applyServerValidation,
  formErrorBinding,
  validationMessageKey,
} from '../apply-server-validation';
import { failureText } from '../report-tx-error';
import { adminErrorKey } from '../admin-error';
import {
  serverValidationError,
  throughServerFnBoundary,
} from './support/serverfn-boundary';

const t = createTranslator('uk');
const tEn = createTranslator('en');

describe('applyServerValidation', () => {
  it('не ValidationError → null (викликач веде звичайним шляхом)', () => {
    const setError = vi.fn();
    expect(applyServerValidation(new Error('x'), setError, { t })).toBeNull();
    expect(applyServerValidation(undefined, setError, { t })).toBeNull();
    expect(
      applyServerValidation({ name: 'ValidationError' }, setError, { t }),
    ).toBeNull();
    expect(setError).not.toHaveBeenCalled();
  });

  it('мапить issue по path у поле, перекладає з params, повертає порожній масив', () => {
    const setError = vi.fn();
    const rest = applyServerValidation(
      serverValidationError([
        {
          path: ['quantity'],
          code: 'too_big',
          params: { origin: 'number', maximum: 1000000 },
        },
      ]),
      setError,
      { t },
    );
    expect(rest).toEqual([]);
    expect(setError).toHaveBeenCalledWith('quantity', {
      type: 'server',
      message: 'Значення завелике: не більше 1000000',
    });
  });

  it('вкладений path за замовчуванням — крапкова нотація RHF', () => {
    const setError = vi.fn();
    applyServerValidation(
      serverValidationError([{ path: ['a', 0, 'b'], code: 'custom' }]),
      setError,
      { t },
    );
    expect(setError).toHaveBeenCalledWith('a.0.b', expect.anything());
  });

  it('fieldFor: null → issue лишається немапленою і повертається викликачу', () => {
    const setError = vi.fn();
    const rest = applyServerValidation(
      serverValidationError([
        { path: ['quantities', 0, 'quantity'], code: 'too_big' },
        { path: [], code: 'custom' },
        { path: ['ghost'], code: 'invalid_type' },
      ]),
      setError,
      {
        t,
        fieldFor: (p) => (p[0] === 'quantities' ? `point-${p[1]}` : null),
      },
    );
    expect(setError).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledWith('point-0', expect.anything());
    expect(rest).toEqual([
      { path: [], code: 'custom' },
      { path: ['ghost'], code: 'invalid_type' },
    ]);
  });

  it('для поля береться перша проблема', () => {
    const setError = vi.fn();
    applyServerValidation(
      serverValidationError([
        { path: ['f'], code: 'invalid_type' },
        { path: ['f'], code: 'too_big' },
      ]),
      setError,
      { t },
    );
    expect(setError).toHaveBeenCalledTimes(1);
    expect(setError.mock.calls[0]![1].message).toBe('Некоректний тип значення');
  });

  it('issues із мережі повторно проходять білий список', () => {
    const setError = vi.fn();
    const rest = applyServerValidation(
      Object.assign(new Error('x'), {
        name: 'ValidationError',
        issues: [
          { path: ['f'], code: 'evil', message: '<script>', input: 'secret' },
        ],
      }),
      setError,
      { t },
    );
    expect(rest).toEqual([]);
    expect(setError).toHaveBeenCalledWith('f', {
      type: 'server',
      message: 'Некоректне значення',
    });
  });

  it('після реальної межі serverFn: помилка поля із issues (контроль — без адаптера)', async () => {
    const src = serverValidationError([
      {
        path: ['quantity'],
        code: 'too_small',
        params: { minimum: 0, origin: 'number' },
      },
    ]);
    const ok = await throughServerFnBoundary(src);
    const setError = vi.fn();
    expect(applyServerValidation(ok, setError, { t })).toEqual([]);
    expect(setError).toHaveBeenCalledTimes(1);

    // Без адаптера issues і name зникають: клієнт не бачить помилку поля.
    const lost = await throughServerFnBoundary(src, { registered: false });
    expect(applyServerValidation(lost, vi.fn(), { t })).toBeNull();
  });
});

describe('переклади admin.validation.*', () => {
  it('кожен код має ключ в uk і en (повнота, не fallback на сам ключ)', () => {
    for (const code of VALIDATION_ISSUE_CODES) {
      for (const tr of [t, tEn]) {
        const key = validationMessageKey({ path: [], code });
        expect(tr(key), `${code} → ${key}`).not.toBe(key);
      }
    }
  });

  it('варіанти origin: рядок і масив мають власні тексти, межі підставляються', () => {
    const msg = (code: 'too_big' | 'too_small', origin: string, v: number) =>
      t(
        validationMessageKey({
          path: [],
          code,
          params: { origin, [code === 'too_big' ? 'maximum' : 'minimum']: v },
        }),
        { [code === 'too_big' ? 'maximum' : 'minimum']: v },
      );
    expect(msg('too_big', 'string', 255)).toBe(
      'Занадто довго: не більше 255 символів',
    );
    expect(msg('too_small', 'array', 1)).toBe('Замало елементів: не менше 1');
  });

  it('invalid_decimal з precision/scale і без', () => {
    const withP = validationMessageKey({
      path: [],
      code: 'invalid_decimal',
      params: { precision: 10, scale: 2 },
    });
    expect(t(withP, { precision: 10, scale: 2 })).toContain('до 10 цифр');
    expect(t(validationMessageKey({ path: [], code: 'invalid_decimal' }))).toBe(
      'Введіть число',
    );
  });
});

describe('adminErrorKey для ValidationError', () => {
  it('загальний ключ (для місць без полів), а не сирий текст', () => {
    expect(adminErrorKey(serverValidationError([]))).toBe(
      'admin.validation.failed',
    );
  });
});

describe('formErrorBinding (RHF)', () => {
  const form = () => ({
    setError: vi.fn(),
    getValues: () => ({ name: '', slug: '', sku: '' }),
  });

  it('мапить лише поля з білого списку, що існують у формі', () => {
    const f = form();
    const b = formErrorBinding(f, ['name', 'slug']);
    const rest = applyServerValidation(
      serverValidationError([
        {
          path: ['slug'],
          code: 'too_big',
          params: { origin: 'string', maximum: 255 },
        },
        { path: ['sku'], code: 'too_big' }, // у формі є, але UI не показує
        { path: ['ghost'], code: 'custom' }, // у формі немає
        { path: ['name', 0], code: 'custom' }, // вкладений
      ]),
      b.setError,
      { t, fieldFor: b.fieldFor },
    );
    expect(f.setError).toHaveBeenCalledTimes(1);
    expect(f.setError).toHaveBeenCalledWith('slug', {
      type: 'server',
      message: 'Занадто довго: не більше 255 символів',
    });
    expect(rest).toHaveLength(3);
  });
});

describe('failureText', () => {
  it('ValidationError → локалізований ключ; звичайна помилка → префікс + message', () => {
    expect(failureText(t, 'Не вдалося:', serverValidationError([]))).toBe(
      'Дані не пройшли перевірку — виправте поля й спробуйте ще раз',
    );
    expect(failureText(t, 'Не вдалося:', new Error('boom'))).toBe(
      'Не вдалося: boom',
    );
  });
});
