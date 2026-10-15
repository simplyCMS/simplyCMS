import { describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ withActor: vi.fn() }));
vi.mock('../with-actor', () => ({ withActor: h.withActor }));

import { pingDatabase } from '../ping';

describe('pingDatabase', () => {
  it('виконує select 1 під роллю app_user і пробрасує відмову БД', async () => {
    const execute = vi.fn(async () => []);
    h.withActor.mockImplementation((_a, fn) => fn({ execute }));
    await pingDatabase();
    expect(h.withActor).toHaveBeenCalledWith(
      { role: 'app_user' },
      expect.any(Function),
    );
    expect(execute).toHaveBeenCalledOnce();
    h.withActor.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(pingDatabase()).rejects.toThrow('ECONNREFUSED');
  });
});
