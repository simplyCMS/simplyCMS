import { describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ withActor: vi.fn() }));
vi.mock('../with-actor', () => ({ withActor: h.withActor }));

import { asService } from '../as-service';

describe('asService', () => {
  it('кличе withActor роллю app_admin БЕЗ userId і повертає результат колбека', async () => {
    const db = { marker: 'db' };
    h.withActor.mockImplementation((_actor, fn) => fn(db));
    const result = await asService(async (d) => d);
    expect(result).toBe(db);
    expect(h.withActor).toHaveBeenCalledWith(
      { role: 'app_admin' },
      expect.any(Function),
    );
    expect(Object.keys(h.withActor.mock.calls[0]![0])).toEqual(['role']);
  });
});
