import { inArray } from 'drizzle-orm';
import { AdminNotFoundError } from 'simplycms/contracts/domain-errors';
import { advisoryXactLockShared, type ActorDb } from 'simplycms/db';
import { LOCK_KEYS } from 'simplycms/db/lock-keys';
import { products } from 'simplycms/schema';

/**
 * Порядок замків агрегата товару (М1, Task 14). Порушення дає 40P01 або 23503.
 * Для кожного пункту названо ВСІ носії гарантії; де їх кілька — вони надлишкові
 * (послаблення одного не знімає гарантію), тож мутація-доказ послаблює всі разом.
 * Тести: `aggregate-language-locks.test.ts`, `catalog-projection-locks.test.ts`,
 * `catalog-projection-order.test.ts`; сканер — `aggregate-lock-order.test.ts`.
 *
 * (1) Завжди `languages-set` (спільний чи ексклюзивний) -> корені товарів (за id) ->
 *     дочірні рядки. Носій порядку «set -> корінь» — ЄДИНИЙ: `lockAggregateRoots` (рядкові
 *     замки `products`, сильніші за KEY SHARE, бере лише він — сканер), що сам бере спільний
 *     `languages-set` перед коренем. Надлишковий носій спільного set на шляху СТВОРЕННЯ —
 *     генератори адрес і токенів (`createPathsForEntity`/`createTokensForEntity`) беруть його
 *     самі, але викликачі (`products.create`, фікстура `inLockedBlock`) беруть його раніше, тож
 *     мутація лише цього носія («генератор читає мови до свого замка») зелена. Тому команда не пише дочірніх рядків з FK на `languages` раніше, ніж
 *     дочекається ексклюзивного власника (`languages.remove`). Мутації: set ПІСЛЯ кореня ->
 *     «products.remove <-> setStatus» 40P01; set прибрано -> ще «saveTranslation <->
 *     languages.remove» і «products.remove <-> languages.remove» 40P01.
 * (2) Власник ЕКСКЛЮЗИВНОГО `languages-set` (`setStatus`, add/remove/reorder мов,
 *     `reconcileProductTexts`, виклик `languages.fill`, що будує проєкцію) рядкових замків
 *     коренів не бере: лише KEY SHARE через FK і вибірки. Ексклюзивний set береться ПЕРШИМ і без
 *     спільного перед ним у тій самій транзакції: підвищення у двох паралельних власників —
 *     40P01. Носії тесту — ексклюзивний замок звірки (мутація «спільний замок у звірці» ->
 *     «reconcile проти команди» перезаписує свіжий рядок застарілим) і fill проєкції
 *     (`fill-projection-race`: спільний замість ексклюзивного -> команда з refresh до коміту
 *     адрес лишає рядок застарілим, «не дочекались»; спільний перед ексклюзивним -> «два fill
 *     паралельно» 40P01).
 * (3) Видалення товару (`products.remove`). Корінь `FOR UPDATE` — два носії на тому самому
 *     рядку, надлишково: `lockProductForRemove` (перший крок після set) і
 *     `snapshotCascadeMedia` (`FOR UPDATE` батька). Порядок модифікацій за id — два носії,
 *     надлишково: той самий знімок (`FOR UPDATE ... ORDER BY id` проміжних рядків `via`) і
 *     `deleteModifications` (хук `deleteRows`). Мутація: усі чотири — NO KEY UPDATE ->
 *     «products.remove <-> fill (засувка на більшій модифікації)» 40P01.
 * (4) Рядки `product_modifications` видаляє лише `deleteModifications` (`FOR UPDATE ...
 *     ORDER BY id`): фабрика відмовляє узагальненому DELETE цієї таблиці, сканер
 *     `modifications-deleter` ловить сирі й аліасні DELETE. У `saveDescription` хелпер —
 *     ЄДИНИЙ носій; у пакетному remove ресурсу і `products.remove` той самий порядок
 *     дублює знімок медіа (`via`). Мутація: обидва носії без FOR UPDATE або `DESC` ->
 *     «saveDescription <-> fill (heap b->a)» червоний ДВОМА сигналами: зі строгою
 *     передумовою кейсу (`second: 'settles'`) — «не дочекались: другий учасник завершився
 *     до відпускання T0» (fill став у чергу на рядок видаляча — причина дедлоку); без неї
 *     (`loose`) — 40P01. «Без ORDER BY» не ловиться — SELECT і так іде індексом
 *     `(product_id, id)` у порядку id.
 * (5) `languages.fill` і звірка беруть на `products` і модифікаціях не сильніше за
 *     `FOR KEY SHARE`, кожен рівень за id. Носії KEY SHARE — `keyShare` (копіювання адрес і
 *     токенів), `buildMissingProjection`, звірка (`reconcile.ts`). Мутація: усі три —
 *     `FOR SHARE` -> «fill <-> видалення розділу» червоний двома сигналами: зі строгою
 *     передумовою — «не дочекались: другий учасник завершився до відпускання T0»; без неї
 *     — 40P01. Корінь у кроці копіювання токенів (`copy.ts`) НАДЛИШКОВИЙ щодо дедлоку:
 *     проєкція — окрема транзакція під ексклюзивним set, а FK `slug_tokens` веде лише на
 *     `product_modifications`, тож токени не беруть KEY SHARE кореня після модифікацій, і
 *     мутація «модифікації без кореня» зелена. Корінь лишено, щоб порядок «корінь ->
 *     модифікації» був однаковим у кожному кроці fill (і щоб пропускати вже видалені товари).
 *     Етап проєкції fill — лише у виклику під ЕКСКЛЮЗИВНИМ set (пункт (2), `fill.ts`, `stages`):
 *     такий виклик чекає коміту всіх команд, що тримають спільний set, і читає закомічене
 *     джерело (І23); адреси й токени копіюються під спільним.
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
 * 🔴 Саме NO KEY UPDATE, а не UPDATE: `FOR UPDATE` кореня блокував би FK-вставки інших
 * транзакцій (KEY SHARE: fill, дочірні рядки інших записувачів) на весь час адмінської
 * команди. Цикл 40P01 «команда <-> setStatus» тут НЕ причина: він неможливий за побудовою,
 * бо команда бере спільний `languages-set` ДО кореня, а власник ексклюзивного set і власник
 * кореня не перетинаються, тож мутація `FOR UPDATE` лишається зеленою.
 */
export function lockProduct(db: ActorDb, id: string): Promise<number> {
  return lockOne(db, id, 'no key update');
}

/** Корінь під `FOR UPDATE` — перший крок `products.remove` (порядок, пункт (3)). */
export function lockProductForRemove(db: ActorDb, id: string): Promise<number> {
  return lockOne(db, id, 'update');
}
