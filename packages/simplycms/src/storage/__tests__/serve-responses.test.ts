import { describe, expect, it } from 'vitest';
import { describeDriverError } from '../serve-responses';

describe('describeDriverError', () => {
  it('🔴 маскує userinfo URL у повідомленні помилки драйвера', () => {
    const error = Object.assign(
      new Error('connect s3://AKID:S3CR3T@garage:3900 refused'),
      { code: 'ECONNREFUSED' },
    );
    const text = describeDriverError(error);
    expect(text).not.toContain('S3CR3T');
    expect(text).not.toContain('AKID');
    expect(text).toBe(
      'Error[ECONNREFUSED]: connect s3://***@garage:3900 refused',
    );
  });

  it('не-Error → unknown', () => {
    expect(describeDriverError('x')).toBe('unknown');
  });
});
