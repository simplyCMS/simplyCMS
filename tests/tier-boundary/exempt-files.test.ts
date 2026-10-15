import { describe, expect, it } from 'vitest';
import { restrictedImports } from './lint';

/**
 * Виняток-ФАЙЛ тір-зони (М1, Task 2): `src/migrate` читає ключ накату з
 * реєстру ключів замків `simplycms/db/lock-keys` — чистих констант без
 * імпортів, — але решта `db` (`withActor`, пул) для накату лишається
 * забороненою: накат іде власником схеми ще до ролей і RLS, і `withActor` там
 * неможливий. Виняток виражено regex-ом у `eslint.tier-zones.mjs`, тож тест
 * перевіряє обидві межі: що відкрито рівно один модуль і що сусіди закриті.
 */
describe('тір-зона migrate: виняток-файл db/lock-keys', () => {
  const MIGRATE = 'packages/simplycms/src/migrate/__tier-fixture.ts';

  it.each([
    'simplycms/db/lock-keys',
    '../db/lock-keys',
    '../../src/db/lock-keys',
  ])('%s — легальний', async (specifier) => {
    expect(await restrictedImports(specifier, MIGRATE)).toEqual([]);
  });

  it.each([
    'simplycms/db',
    'simplycms/db/with-actor',
    'simplycms/db/lock-keys-extra',
    'simplycms/db/lock-keys/inner',
    '../db',
    '../db/with-actor',
    '../db/lock-keys-extra',
    '../../src/db/with-actor',
  ])('%s — досі заборонений', async (specifier) => {
    const errors = await restrictedImports(specifier, MIGRATE);
    expect(errors, specifier).toHaveLength(1);
    expect(errors[0]).toContain('Тір-зона ПК3');
  });

  it('виняток діє лише в migrate: prod-start реєстр ключів не імпортує', async () => {
    const errors = await restrictedImports(
      'simplycms/db/lock-keys',
      'packages/simplycms/src/prod-start/__tier-fixture.ts',
    );
    expect(errors).toHaveLength(1);
  });
});
