import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_AVATAR_BYTES,
  MAX_REQUEST_BODY_BYTES,
  MAX_REVIEW_IMAGES,
  MAX_REVIEW_IMAGE_BYTES,
  MAX_UPLOAD_BYTES,
  LENGTH_REQUIRED_CODE,
  MULTIPART_OVERHEAD_BYTES,
  PAYLOAD_TOO_LARGE_CODE,
} from '../../domain/media';
import { checkBodyLimit } from '../body-limit';

const MULTIPART = 'multipart/form-data; boundary=----x';

function req(
  method: string,
  path: string,
  headers: Record<string, string> = {},
): Request {
  return new Request(`http://localhost${path}`, { method, headers });
}

describe('MAX_REQUEST_BODY_BYTES — виводиться з доменних констант', () => {
  it('вміщує 5 фото відгуку з запасом на multipart-обгортку', () => {
    expect(MAX_REQUEST_BODY_BYTES).toBeGreaterThanOrEqual(
      MAX_REVIEW_IMAGES * MAX_REVIEW_IMAGE_BYTES + MULTIPART_OVERHEAD_BYTES,
    );
  });
  it('вміщує завантаження медіа й аватар', () => {
    expect(MAX_REQUEST_BODY_BYTES).toBeGreaterThanOrEqual(MAX_UPLOAD_BYTES);
    expect(MAX_REQUEST_BODY_BYTES).toBeGreaterThanOrEqual(MAX_AVATAR_BYTES);
  });
});

describe('checkBodyLimit', () => {
  it('multipart понад стелю → 413', () => {
    const res = checkBodyLimit(
      req('POST', '/_serverFn/x', {
        'content-type': MULTIPART,
        'content-length': String(MAX_REQUEST_BODY_BYTES + 1),
      }),
    );
    expect(res?.status).toBe(413);
  });
  it('відмова несе машинний код і content-type (клієнт Start читає лише так)', async () => {
    const big = checkBodyLimit(
      req('POST', '/_serverFn/x', {
        'content-length': String(MAX_REQUEST_BODY_BYTES + 1),
      }),
    );
    expect(big?.headers.get('content-type')).toContain('text/plain');
    expect(await big?.text()).toBe(PAYLOAD_TOO_LARGE_CODE);
    const noLen = checkBodyLimit(
      req('POST', '/_serverFn/x', { 'content-type': MULTIPART }),
    );
    expect(await noLen?.text()).toBe(LENGTH_REQUIRED_CODE);
  });
  it.each([
    'application/json; x=multipart/form-data',
    'application/json; x=application/x-www-form-urlencoded',
    'Application/JSON; X=Multipart/Form-Data',
  ])('%s без content-length → 411 (Start прочитав би як форму)', (ct) => {
    const res = checkBodyLimit(
      req('POST', '/_serverFn/x', { 'content-type': ct }),
    );
    expect(res?.status).toBe(411);
  });
  it('multipart без content-length → 411', () => {
    const res = checkBodyLimit(
      req('POST', '/_serverFn/x', { 'content-type': MULTIPART }),
    );
    expect(res?.status).toBe(411);
  });
  it.each([
    'application/x-www-form-urlencoded',
    'text/plain; x=multipart/form-data',
    'text/plain; x=application/json',
    '',
  ])('chunked %j → 411 (Start читає formData/невідоме)', (type) => {
    const headers: Record<string, string> = type
      ? { 'content-type': type }
      : {};
    expect(checkBodyLimit(req('POST', '/_serverFn/x', headers))?.status).toBe(
      411,
    );
  });
  it('chunked JSON з параметрами/регістром → пропуск (прийнятий ризик)', () => {
    for (const type of [
      'Application/JSON; charset=utf-8',
      'application/json',
    ]) {
      expect(
        checkBodyLimit(req('POST', '/_serverFn/x', { 'content-type': type })),
      ).toBeNull();
    }
  });
  it('JSON без content-length → пропуск', () => {
    expect(
      checkBodyLimit(
        req('POST', '/_serverFn/x', { 'content-type': 'application/json' }),
      ),
    ).toBeNull();
  });
  it('JSON понад стелю → 413', () => {
    const res = checkBodyLimit(
      req('POST', '/_serverFn/x', {
        'content-type': 'application/json',
        'content-length': String(MAX_REQUEST_BODY_BYTES + 1),
      }),
    );
    expect(res?.status).toBe(413);
  });
  it('multipart рівно на стелі → пропуск', () => {
    expect(
      checkBodyLimit(
        req('POST', '/_serverFn/x', {
          'content-type': MULTIPART,
          'content-length': String(MAX_REQUEST_BODY_BYTES),
        }),
      ),
    ).toBeNull();
  });
  it('GET → пропуск', () => {
    expect(
      checkBodyLimit(
        req('GET', '/_serverFn/x', {
          'content-length': String(MAX_REQUEST_BODY_BYTES + 1),
        }),
      ),
    ).toBeNull();
  });
  it('POST не на /_serverFn/ → пропуск', () => {
    expect(
      checkBodyLimit(
        req('POST', '/api/auth/x', {
          'content-length': String(MAX_REQUEST_BODY_BYTES + 1),
        }),
      ),
    ).toBeNull();
  });
  it('нечисловий content-length → 413 (не пропускаємо сміття)', () => {
    const res = checkBodyLimit(
      req('POST', '/_serverFn/x', { 'content-length': 'abc' }),
    );
    expect(res?.status).toBe(413);
  });
});

describe('checkBodyLimit — база server functions із рантайму', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('TSS_SERVER_FN_BASE з basepath: стеля на новій базі, не на старій', () => {
    vi.stubEnv('TSS_SERVER_FN_BASE', '/shop/_serverFn/');
    const headers = { 'content-length': String(MAX_REQUEST_BODY_BYTES + 1) };
    expect(
      checkBodyLimit(req('POST', '/shop/_serverFn/x', headers))?.status,
    ).toBe(413);
    expect(checkBodyLimit(req('POST', '/_serverFn/x', headers))).toBeNull();
  });
});
