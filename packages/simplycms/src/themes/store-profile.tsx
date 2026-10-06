import { createContext, useContext, type ReactNode } from 'react';
import type { StorefrontProfile } from 'simplycms/contracts/store-profile';

/**
 * Профіль магазину для тем (Е6б-12): назва, контакти, соцмережі, логотип.
 *
 * Тема отримує логотип уже URL-ом (`logoUrl`): порту сховища вона не знає, а
 * окремий тип не дає сплутати референс із URL на рівні компіляції.
 *
 * Дефолт контексту — `null`: відсутній провайдер означає зламаний host, і
 * тихий порожній профіль сховав би це за безіменною шапкою.
 */
const StoreProfileContext = createContext<StorefrontProfile | null>(null);

/** Монтує host `src/routes/__root.tsx` над `Outlet` із даних кореневого лоадера. */
export function StoreProfileProvider({
  profile,
  children,
}: {
  profile: StorefrontProfile;
  children: ReactNode;
}) {
  return (
    <StoreProfileContext.Provider value={profile}>
      {children}
    </StoreProfileContext.Provider>
  );
}

/** Профіль магазину вітрини; поза `StoreProfileProvider` кидає. */
export function useStoreProfile(): StorefrontProfile {
  const profile = useContext(StoreProfileContext);
  if (profile === null) {
    throw new Error(
      'useStoreProfile використано поза <StoreProfileProvider> — його монтує ' +
        'host src/routes/__root.tsx над <Outlet />',
    );
  }
  return profile;
}
