import { describe, expect, it } from 'vitest';
import { EMPTY_STORE_PROFILE } from 'simplycms/domain/store-profile';
import { toStorefrontProfile } from '../store-profile';

describe('toStorefrontProfile', () => {
  it('порожній профіль → logoUrl: null, без поля logo', () => {
    const out = toStorefrontProfile(EMPTY_STORE_PROFILE);
    expect(out.logoUrl).toBeNull();
    expect('logo' in out).toBe(false);
  });

  it('референс логотипа резолвиться в URL роздачі', () => {
    const key = 'ab/ab000000-0000-4000-8000-000000000000.png';
    const out = toStorefrontProfile({ ...EMPTY_STORE_PROFILE, logo: key });
    expect(out.logoUrl).toBe(`/media/${key}`);
  });
});
