import { describe, expect, it } from 'vitest';
import { LOCK_KEYS, MIGRATION_LOCK_KEY } from '../lock-keys';

/**
 * Значення ключів — ЛІТЕРАЛИ, а не повтор виразу з коду: ключі хешуються так
 * само в хелперах харнеса (`holdAdvisoryLock`) і читаються з `pg_locks`, тож
 * мовчазна зміна значення розводить замок коду із замком тесту. Правка рядка
 * нижче — свідоме рішення, а не побічний ефект рефакторингу реєстру.
 */
describe('реєстр ключів advisory-замків', () => {
  it('ключ накату — ASCII «SCMSMIGR», число, а не рядок', () => {
    expect(MIGRATION_LOCK_KEY.toString()).toBe('5999724148761904978');
    expect(MIGRATION_LOCK_KEY.toString(16)).toBe(
      Buffer.from('SCMSMIGR').toString('hex'),
    );
    expect(LOCK_KEYS.migration).toBe(MIGRATION_LOCK_KEY);
  });

  it('рядкові ключі й префікси — зафіксовані літерали', () => {
    const { migration, ...strings } = LOCK_KEYS;
    expect(typeof migration).toBe('bigint');
    expect(strings).toEqual({
      languagesSet: 'languages-set',
      adminRoles: 'admin-roles',
      customerCategoryPrefix: 'customer-category:',
      customerConfig: 'customer-config',
      discountConfig: 'discount-config',
      shippingConfig: 'shipping-config',
      siteTheme: 'site-theme',
      storeProfile: 'store-profile',
      priceTypeDefault: 'price-type-default',
      stockPrefix: 'stock:',
      pricesPrefix: 'prices:',
      modDefaultPrefix: 'mod-default:',
    });
  });
});
