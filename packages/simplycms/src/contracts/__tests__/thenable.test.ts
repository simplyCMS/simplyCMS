import { describe, expect, it } from 'vitest';
import { trackThenable } from '../thenable';

describe('trackThenable', () => {
  it('після await позначає fulfilled зі значенням і повертає той самий проміс', async () => {
    const source = Promise.resolve(42);
    const tracked = trackThenable(source);
    expect(tracked).toBe(source);
    expect(tracked.status).toBe('pending');
    await tracked;
    expect(tracked.status).toBe('fulfilled');
    expect(tracked.value).toBe(42);
  });

  it('відхилений проміс — rejected з причиною', async () => {
    const boom = new Error('boom');
    const tracked = trackThenable(Promise.reject(boom));
    await tracked.catch(() => undefined);
    expect(tracked.status).toBe('rejected');
    expect(tracked.reason).toBe(boom);
  });
});
