import { describe, expect, it } from 'vitest';
import { assertActorRole, buildActorPrelude } from '../actor';

// Юніти db-рантайму, які НЕ потребують Postgres (Task 6, план В2-К1а):
// валідація аргументів і ФОРМА преамбули. Поведінку в БД (ізоляція A/B,
// скидання після COMMIT, ROLLBACK) доводить окремий гейт `test:schema` —
// тут перевіряється рівно те, що можна перевірити без сервера.

const UUID_A = '11111111-1111-4111-8111-111111111111';

describe('assertActorRole', () => {
  it.each(['app_user', 'app_admin'])('пропускає %s', (role) => {
    expect(() => assertActorRole(role)).not.toThrow();
  });

  it.each(['app_runtime', 'postgres', 'app_user; drop table orders', ''])(
    'відбиває %s',
    (role) => {
      // 🔴 Кейс `app_runtime` — не формальність: саме вона логіниться в БД,
      // і робота під нею означала б запит БЕЗ звуження прав. Кейс з `;` —
      // про те, що імʼя ролі неминуче йде в SQL інтерполяцією.
      expect(() => assertActorRole(role)).toThrow(/Невідома роль актора/);
    },
  );
});

describe('buildActorPrelude', () => {
  it('claims ідуть ДО SET LOCAL ROLE, обидва GUC — завжди', () => {
    const prelude = buildActorPrelude({ role: 'app_user', userId: UUID_A });

    expect(prelude.map((s) => s.text)).toEqual([
      `select set_config('app.user_id', $1, true)`,
      `select set_config('app.order_token', $1, true)`,
      'set local role app_user',
    ]);
    // Токена не передавали — GUC усе одно виставляється, у порожнє: зʼєднання
    // приходить із пулу, і пропущений `set_config` лишив би там чуже значення.
    expect(prelude.map((s) => s.values)).toEqual([[UUID_A], [''], []]);
  });

  it('анонім і гість: порожній userId, токен на місці', () => {
    expect(buildActorPrelude({ role: 'app_user' })[0].values).toEqual(['']);
    expect(
      buildActorPrelude({ role: 'app_user', userId: null })[0].values,
    ).toEqual(['']);
    expect(
      buildActorPrelude({ role: 'app_user', orderToken: 'tok-42' })[1].values,
    ).toEqual(['tok-42']);
  });

  it('🔴 local=true зашито в усі set_config — параметра немає', () => {
    // Контроль саме на текст: `false` третім аргументом лишає claims до кінця
    // ЗʼЄДНАННЯ, і наступний клієнт пулу дістає чужу ідентичність (витік
    // виміряно негативним контролем гейта RLS, Task 5). Тому опції «зробити
    // scope параметром» тут не існує — і цей тест її не дає повернути.
    for (const statement of buildActorPrelude({
      role: 'app_admin',
      userId: UUID_A,
      orderToken: 'tok',
    }).slice(0, 2))
      expect(statement.text).toContain(', true)');
  });

  it('валідація userId: не-UUID падає до походу в БД', () => {
    expect(() =>
      buildActorPrelude({ role: 'app_user', userId: 'not-a-uuid' }),
    ).toThrow(/userId має бути UUID/);
  });

  it('невалідна роль падає ще на побудові преамбули', () => {
    expect(() =>
      buildActorPrelude({
        role: 'app_runtime' as unknown as 'app_user',
        userId: UUID_A,
      }),
    ).toThrow(/Невідома роль актора/);
  });
});
