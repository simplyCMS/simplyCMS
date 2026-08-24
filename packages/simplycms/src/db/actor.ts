/**
 * Актор транзакції та ЧИСТА побудова її преамбули (Task 6, В2-К1а).
 *
 * Винесено з `./with-actor` навмисно: форма SQL і валідація аргументів — це
 * рівно те, що можна довести юнітом БЕЗ Postgres, тож вони не мають ховатися
 * всередині обгортки, яка без БД не запускається.
 */

/**
 * Ролі БД, під якими виконується запит (B5″). Обидві — nologin, обидві
 * видаються рантайм-ролі через `SET LOCAL ROLE`. `app_runtime` у переліку
 * НЕМАЄ свідомо: вона не має прямих грантів, і працювати під нею — це і є
 * той fail-closed, який дизайн вимагає лишити недосяжним.
 */
export type ActorRole = 'app_user' | 'app_admin';

const ACTOR_ROLES: readonly ActorRole[] = ['app_user', 'app_admin'];

/** Хто саме виконує транзакцію. */
export interface Actor {
  /** Роль БД; вмикається `SET LOCAL ROLE` після типізованої перевірки в TS. */
  readonly role: ActorRole;
  /** UUID користувача або `null`/відсутнє для аноніма й гостя. */
  readonly userId?: string | null;
  /** Токен гостьового замовлення (GUC `app.order_token`). */
  readonly orderToken?: string | null;
}

/** Один стейтмент преамбули: текст + параметри. */
export interface PreludeStatement {
  readonly text: string;
  readonly values: readonly string[];
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Перевіряє роль ДО походу в БД.
 *
 * 🔴 Причина не в типах: `SET LOCAL ROLE` не параметризується (це команда
 * сесії, а не вираз), тож імʼя ролі неминуче потрапляє в SQL інтерполяцією.
 * TS-тип на межі процесу нічого не гарантує — значення могло приїхати з JSON
 * запиту. Замкнений перелік тут і є те, що робить інтерполяцію безпечною.
 */
export function assertActorRole(role: string): asserts role is ActorRole {
  if (!ACTOR_ROLES.includes(role as ActorRole)) {
    throw new Error(
      `[simplycms/db] Невідома роль актора: ${JSON.stringify(role)}. ` +
        `Дозволені — ${ACTOR_ROLES.join(', ')}.`,
    );
  }
}

/**
 * Стейтменти преамбули актора у ФІКСОВАНОМУ порядку:
 * claims → `SET LOCAL ROLE`.
 *
 * 🔴 Порядок не косметичний: після перемикання ролі права звужуються, і
 * преамбула мусить завершитись раніше, ніж почнеться робота під ними.
 *
 * 🔴 Обидва GUC виставляються ЗАВЖДИ, навіть у порожнє значення. По-перше,
 * `app.current_user_id()` і предикат гостьового замовлення читають їх через
 * `nullif(…, '')`, тож порожній рядок — це коректний «нікого немає».
 * По-друге, зʼєднання приходить із ПУЛУ: якби хтось раніше виставив той
 * самий GUC сесійно, пропущений `set_config` лишив би чужу ідентичність, а
 * безумовний — перекриває її на цю транзакцію.
 *
 * 🔴 Третій аргумент `set_config` — завжди `true` (local), і параметром він
 * не робиться НІКОЛИ: з `false` значення живе до кінця зʼєднання, а не
 * транзакції, тобто наступний клієнт пулу дістав би чужі claims. Це не
 * теорія — витік виміряно негативним контролем гейта RLS (Task 5).
 */
export function buildActorPrelude(actor: Actor): PreludeStatement[] {
  assertActorRole(actor.role);

  const userId = actor.userId ?? '';
  if (userId !== '' && !UUID_RE.test(userId)) {
    // Без цієї перевірки помилка вилізла б аж у `::uuid` всередині
    // `app.current_user_id()` — тобто на першому ж читанні таблиці, і
    // діагноз виглядав би як проблема політики, а не аргументу.
    throw new Error(
      `[simplycms/db] userId має бути UUID, отримано ${JSON.stringify(userId)}.`,
    );
  }

  return [
    { text: `select set_config('app.user_id', $1, true)`, values: [userId] },
    {
      text: `select set_config('app.order_token', $1, true)`,
      values: [actor.orderToken ?? ''],
    },
    // Інтерполяція безпечна рівно завдяки `assertActorRole` вище.
    { text: `set local role ${actor.role}`, values: [] },
  ];
}
