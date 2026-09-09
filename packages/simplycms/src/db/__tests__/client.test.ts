import { afterEach, describe, expect, it } from 'vitest';
import { closeDbPool, getDbPool, resolveDatabaseUrl } from '../client';

// Юніт контракту env db-рантайму (Task 6, план В2-К1а). Живого Postgres не
// потребує: `new pg.Pool()` конекту не відкриває — перше зʼєднання беруть
// лише `connect()`/`query()`, яких тут немає.

describe('resolveDatabaseUrl', () => {
  it('віддає заданий рядок підключення', () => {
    expect(
      resolveDatabaseUrl({ DATABASE_URL: 'postgresql://u@h:5432/db' }),
    ).toBe('postgresql://u@h:5432/db');
  });

  it.each([{}, { DATABASE_URL: '' }, { DATABASE_URL: undefined }])(
    'падає гучно на %j',
    (env) => {
      // Порожній рядок — це відсутній ключ, а не «конект у нікуди»: інакше
      // `DATABASE_URL=` у .env дало б помилку драйвера замість діагнозу.
      expect(() => resolveDatabaseUrl(env)).toThrow(/DATABASE_URL/);
    },
  );
});

describe('getDbPool', () => {
  afterEach(async () => {
    await closeDbPool();
    delete process.env.DATABASE_URL;
  });

  it('читає env у РАНТАЙМІ, а не на модуль-рівні', () => {
    // Модуль уже імпортований (див. import вище) — і саме зараз ключа немає.
    // Якби фабрика читала env при завантаженні, цей рядок не впав би.
    delete process.env.DATABASE_URL;
    expect(() => getDbPool()).toThrow(/DATABASE_URL/);

    process.env.DATABASE_URL = 'postgresql://u@127.0.0.1:1/db';
    expect(getDbPool()).toBeDefined();
  });

  it('пул один на процес, closeDbPool скидає його', async () => {
    process.env.DATABASE_URL = 'postgresql://u@127.0.0.1:1/db';
    const first = getDbPool();
    expect(getDbPool()).toBe(first);

    await closeDbPool();
    expect(getDbPool()).not.toBe(first);
  });

  it('closeDbPool ідемпотентна', async () => {
    await expect(closeDbPool()).resolves.toBeUndefined();
    await expect(closeDbPool()).resolves.toBeUndefined();
  });
});
