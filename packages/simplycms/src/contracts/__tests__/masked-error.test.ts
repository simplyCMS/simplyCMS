import { describe, expect, it } from 'vitest';
import {
  describePublicError,
  maskedErrorMessage,
  parseMaskedErrorRef,
} from '../masked-error';

describe('masked-error', () => {
  it('ідентифікатор переживає круг формат → розбір', () => {
    expect(parseMaskedErrorRef(maskedErrorMessage('ab12cd34'))).toBe(
      'ab12cd34',
    );
    expect(parseMaskedErrorRef('Failed query: select 1')).toBeNull();
    expect(parseMaskedErrorRef(undefined)).toBeNull();
  });

  it('прод: текст непередбаченої помилки не показується, ідентифікатор — так', () => {
    const view = describePublicError(
      new Error(maskedErrorMessage('ab12cd34')),
      false,
    );
    expect(view).toEqual({ message: null, ref: 'ab12cd34' });
    expect(
      describePublicError(new Error('Failed query: select 1'), false).message,
    ).toBeNull();
  });

  it('доменна помилка з кодом показує свій текст і в проді', () => {
    const error = Object.assign(new Error('Операція заборонена'), {
      name: 'AuthzError',
    });
    expect(describePublicError(error, false).message).toBe(
      'Операція заборонена',
    );
  });

  it('dev (expose): текст показується як раніше', () => {
    expect(describePublicError(new Error('boom'), true).message).toBe('boom');
  });

  it('не-обʼєкт не ламає розбір', () => {
    expect(describePublicError('рядок', false)).toEqual({
      message: null,
      ref: null,
    });
  });
});
