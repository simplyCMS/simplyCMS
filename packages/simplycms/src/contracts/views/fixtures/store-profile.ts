// Фікстура профілю магазину для conformance-kit-а (Е6б-20).

import type { StorefrontProfile } from '../../store-profile';

/**
 * Повний профіль: логотип, всі контакти й дві соцмережі. Kit обгортає нею
 * кожен view, бо тема читає бренд і контакти з `useStoreProfile()` — без
 * провайдера хук кидає, і view, що його використовує, не пройшов би гейт.
 */
export const STORE_PROFILE_FIXTURE: StorefrontProfile = {
  name: 'Тестова крамниця',
  homeTitle: null,
  description: null,
  contacts: {
    phone: '+380 (44) 123-45-67',
    email: 'shop@example.com',
    address: 'Київ, вул. Тестова, 1',
    hours: 'Пн–Пт 9–18',
  },
  logoUrl: '/media/logo.png',
  socials: [
    { network: 'instagram', url: 'https://instagram.com/test-shop' },
    { network: 'telegram', url: 'https://t.me/test_shop' },
  ],
};
