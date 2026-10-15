// М1 Task 6: спільний замок не блокує спільний, але блокує ексклюзивний (і
// навпаки) — на цьому тримається Review Focus 1 (створення сутностей
// паралельні, додавання мови їх чекає).
import { describe, expect, it } from 'vitest';
import { advisoryXactLock, advisoryXactLockShared } from 'simplycms/db';
import { useAddressingDb } from './fixtures/addressing-db';
import { hold, until, waiters } from './fixtures/lock-holders';

describe('advisory-замки: спільний і ексклюзивний', () => {
  const db = useAddressingDb('simplycms_advisory_shared');
  const shared = (key: string) => (d: Parameters<typeof advisoryXactLock>[0]) =>
    advisoryXactLockShared(d, key);
  const exclusive =
    (key: string) => (d: Parameters<typeof advisoryXactLock>[0]) =>
      advisoryXactLock(d, key);

  it('спільний + спільний: друга транзакція не чекає першу', async () => {
    const a = hold(db, shared('k-ss'));
    await until('перший спільний', a.acquired);
    const b = hold(db, shared('k-ss'));
    await until('другий спільний (без очікування)', b.acquired);
    expect(await waiters(db)).toBe(0);
    a.release();
    b.release();
    await Promise.all([a.done, b.done]);
  });

  it.each([
    ['спільний → ексклюзивний', shared, exclusive],
    ['ексклюзивний → спільний', exclusive, shared],
    ['ексклюзивний → ексклюзивний', exclusive, exclusive],
  ])('%s: друга чекає завершення першої', async (_name, first, second) => {
    const key = `k-${_name}`;
    const a = hold(db, first(key));
    await until('перший замок', a.acquired);
    const b = hold(db, second(key));
    await until(
      'друга транзакція стала в чергу',
      async () => (await waiters(db)) === 1,
    );
    expect(b.acquired()).toBe(false);
    a.release();
    await until('друга отримала замок після коміту першої', b.acquired);
    b.release();
    await Promise.all([a.done, b.done]);
  });
});
