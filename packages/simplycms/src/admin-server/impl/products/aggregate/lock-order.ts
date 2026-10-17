import { inArray } from 'drizzle-orm';
import { AdminNotFoundError } from 'simplycms/contracts/domain-errors';
import { advisoryXactLockShared, type ActorDb } from 'simplycms/db';
import { LOCK_KEYS } from 'simplycms/db/lock-keys';
import { products } from 'simplycms/schema';

/**
 * Порядок замків агрегата товару (М1, Task 14). Порушення дає 40P01 або 23503.
 *
 * (1) Завжди `languages-set` (спільний чи ексклюзивний) -> корені товарів (за id) ->
 *     дочірні рядки. Рядкові замки `products`, сильніші за KEY SHARE, бере ЛИШЕ
 *     `lockAggregateRoots` (сканер `aggregate-lock-order.test.ts`); він сам бере спільний
 *     `languages-set` перед коренем. Тому команда не пише дочірніх рядків з FK на
 *     `languages` (переклади, адреси) раніше, ніж дочекається ексклюзивного власника
 *     (`languages.remove`), який видаляє ті самі таблиці для мови. Тести —
 *     `aggregate-language-locks.test.ts`: «saveTranslation <-> languages.remove» (set
 *     прибрано -> 40P01), «products.remove <-> setStatus» (set ПІСЛЯ кореня -> 40P01),
 *     «products.remove <-> languages.remove» (set прибрано лише з видалення -> 40P01:
 *     каскади товару й мови беруть токени мови й рядки мови в протилежних порядках).
 * (2) Власник ЕКСКЛЮЗИВНОГО `languages-set` (`setStatus`, add/remove/reorder мов,
 *     `reconcileProductTexts`) рядкових замків коренів не бере: лише KEY SHARE через FK і
 *     вибірки. Видаляти рядки мови (проєкцію, каскад `languages.remove`) він може, бо
 *     команди й видалення товару стоять у черзі на `languages-set` ДО своїх рядків. Тест
 *     «reconcile проти команди» (мутація «спільний замок у звірці» -> застарілий рядок).
 * (3) Видалення кореня — `FOR UPDATE` першим кроком після set (`lockProductForRemove`).
 *     Порядок модифікацій у `products.remove` тримає знімок каскадних медіа (FOR UPDATE
 *     батька, далі модифікацій за id) — це другий носій; тест «products.remove <-> fill
 *     (засувка на більшій модифікації)» червоніє, лише коли обидва носії послаблено до NKU.
 * (4) Рядки `product_modifications` видаляє лише `deleteModifications` (`FOR UPDATE ...
 *     ORDER BY id`): фабрика відмовляє узагальненому DELETE цієї таблиці, сканер
 *     `modifications-deleter` ловить сирі й аліасні DELETE. У `saveDescription` хелпер —
 *     ЄДИНИЙ носій порядку; у пакетному remove ресурсу і `products.remove` той самий
 *     порядок дублюють знімки медіа (`FOR UPDATE ... ORDER BY id`). Тест «saveDescription
 *     <-> fill (heap b->a)»: мутації «без FOR UPDATE» і `DESC` -> 40P01; «без ORDER BY»
 *     не ловиться — SELECT і так іде індексом `(product_id, id)` у порядку id.
 * (5) `languages.fill` і звірка беруть на `products` і модифікаціях не сильніше за
 *     `FOR KEY SHARE`, кожен рівень за id; КОЖЕН крок fill бере корінь перед своїми
 *     дочірніми, незалежно від того, чи блокував його попередній крок. KEY SHARE сумісний
 *     із NO KEY UPDATE команд і каскаду `SET NULL` розділу. Тести «fill <-> видалення
 *     розділу» (`FOR SHARE` -> 40P01), «products.remove <-> fill (адреса в мові вже є)»
 *     («модифікації без кореня» -> 40P01).
 * Неявні NO KEY UPDATE поза агрегатом (каскад `SET NULL` розділу, `setTargetStatus` на
 * checkout) сумісні з KEY SHARE fill і не тримають рядків агрегата.
 */
export async function lockAggregateRoots(
  db: ActorDb,
  ids: readonly string[],
  strength: 'no key update' | 'update',
): Promise<Map<string, number>> {
  const unique = [...new Set(ids)].sort();
  if (unique.length === 0) return new Map();
  await advisoryXactLockShared(db, LOCK_KEYS.languagesSet);
  const rows = await db
    .select({ id: products.id, version: products.version })
    .from(products)
    .where(inArray(products.id, unique))
    .orderBy(products.id)
    .for(strength);
  return new Map(rows.map((r) => [r.id, r.version]));
}

async function lockOne(
  db: ActorDb,
  id: string,
  strength: 'no key update' | 'update',
): Promise<number> {
  const version = (await lockAggregateRoots(db, [id], strength)).get(id);
  if (version === undefined) throw new AdminNotFoundError('товар');
  return version;
}

/**
 * Корінь агрегата під `FOR NO KEY UPDATE` — ПЕРШИЙ крок кожної команди: усі записи
 * опису й перекладів серіалізуються на ньому (версія, хеш джерела, І13/І14).
 * 🔴 Саме NO KEY UPDATE, а не UPDATE: `FOR UPDATE` конфліктує з `FOR KEY SHARE`, який
 * беруть FK вставок і вибірки fill/setStatus, і повернув би цикл 40P01 «команда <->
 * setStatus» (мутація `FOR UPDATE` -> 40P01, `catalog-projection-locks`).
 */
export function lockProduct(db: ActorDb, id: string): Promise<number> {
  return lockOne(db, id, 'no key update');
}

/** Корінь під `FOR UPDATE` — перший крок `products.remove` (порядок, пункт (3)). */
export function lockProductForRemove(db: ActorDb, id: string): Promise<number> {
  return lockOne(db, id, 'update');
}
