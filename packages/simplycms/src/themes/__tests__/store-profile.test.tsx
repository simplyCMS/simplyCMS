// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { StorefrontProfile } from 'simplycms/contracts/store-profile';
import { StoreProfileProvider, useStoreProfile } from '../store-profile';

/**
 * Профіль магазину для тем (Е6б-12): провайдер монтує host над `Outlet`.
 * Без провайдера хук кидає — тихий порожній профіль сховав би помилку
 * збірки магазину за безіменною шапкою.
 */

const PROFILE: StorefrontProfile = {
  name: 'Крамниця',
  homeTitle: null,
  description: null,
  contacts: { phone: null, email: null, address: null, hours: null },
  logoUrl: '/media/logo.png',
  socials: [],
};

describe('useStoreProfile', () => {
  it('віддає профіль із провайдера', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StoreProfileProvider profile={PROFILE}>{children}</StoreProfileProvider>
    );
    const { result } = renderHook(() => useStoreProfile(), { wrapper });
    expect(result.current).toBe(PROFILE);
  });

  it('без провайдера кидає з підказкою про host', () => {
    expect(() => renderHook(() => useStoreProfile())).toThrow(
      /StoreProfileProvider/,
    );
  });
});
