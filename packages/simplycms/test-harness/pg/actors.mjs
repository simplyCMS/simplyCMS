// Транзакційна обгортка «актора» для поведінкового гейта RLS (Task 5,
// план В2-К1а).
//
// Форма — точно та, яку зобовʼязана ставити рантайм-обгортка `withActor`
// (`simplycms/db`, Task 6):
//
//   BEGIN;
//   select set_config('app.user_id', <uuid>, true);
//   SET LOCAL ROLE app_user;
//   …;
//   COMMIT;
//
// 🔴 Тут вона живе як ТЕСТОВА копія контракту, а не як його реалізація.
// Гейт мусить міряти базу даних, а не рантайм: якби він імпортував той самий
// код, що й прод, то поламаний `withActor` (наприклад, із `local=false`)
// лишався б зеленим — тест перевіряв би сам себе. Саме тому третій негативний
// контроль ставить `local=false` руками й показує витік claims.
//
// Порядок стейтментів у преамбулі не косметичний: `set_config` іде ДО
// `SET LOCAL ROLE`, бо після перемикання ролі права звужуються, і преамбула
// має завершитись раніше, ніж почнеться робота під звуженими правами.
import pg from 'pg';

/** Стейтменти преамбули актора: claims + перемикання ролі. */
function actorPrelude(actor) {
  const scope = actor.localClaims === false ? 'false' : 'true';
  const prelude = [];
  if (actor.userId !== undefined)
    prelude.push({
      text: `select set_config('app.user_id', $1, ${scope})`,
      values: [actor.userId],
    });
  if (actor.orderToken !== undefined)
    prelude.push({
      text: `select set_config('app.order_token', $1, ${scope})`,
      values: [actor.orderToken],
    });
  // `SET LOCAL ROLE` не параметризується (це не вираз, а команда сесії);
  // імена ролей тут — константи самих тестів, не зовнішній вхід.
  if (actor.role)
    prelude.push({ text: `set local role ${actor.role}`, values: [] });
  return prelude;
}

/**
 * Одне зʼєднання, кілька транзакцій-акторів поспіль. Потрібне саме тому, що
 * витік claims через COMMIT видно ЛИШЕ на тому самому зʼєднанні — нове
 * зʼєднання починає з чистими GUC і мовчки сховало б дефект.
 *
 * `fn` отримує `run(actor, statements)`; повертає рядки останнього стейтмента.
 */
export async function withActorSession(connectionString, fn) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    return await fn(async (actor, statements) => {
      await client.query('begin');
      try {
        for (const stmt of actorPrelude(actor))
          await client.query(stmt.text, stmt.values);
        let rows = [];
        for (const sql of statements) rows = (await client.query(sql)).rows;
        await client.query('commit');
        return rows;
      } catch (err) {
        await client.query('rollback');
        throw err;
      }
    });
  } finally {
    await client.end();
  }
}

/**
 * Разова транзакція від імені актора: зʼєднання, преамбула, стейтменти,
 * COMMIT, розрив. Повертає рядки останнього стейтмента; помилка будь-якого
 * (у т.ч. `permission denied` чи порушення WITH CHECK) прокидується назовні —
 * саме її і ловлять негативні кейси матриці.
 */
export async function withActor(connectionString, actor, statements) {
  return withActorSession(connectionString, (run) => run(actor, statements));
}
