/**
 * Команди реєстру операцій у транзакції сіду (М1, Task 12).
 *
 * 🔴 Сід пише агрегат товару лише командами (`products.create`,
 * `products.saveDescription`, `products.savePrices`, `products.saveStock`), а не
 * фабрикою ресурсів: так модифікації отримують токени, значення — вид, фото —
 * рядки `product_images`, і сід не розходиться з тим, що створює адмінка.
 * Виконавець (`executeOperation`) тут не годиться: він відкриває свою
 * транзакцію, а сід живе в одній, тож `run` кличеться напряму з валідацією
 * входу тією ж схемою.
 */
import type {
  OperationDef,
  OperationContext,
} from '../../packages/simplycms/src/operations/index.ts';
import type { ActorDb } from '../../packages/simplycms/src/db/index.ts';

/** Хвости `afterCommit`: сід нічого не стирає, тож їх очікувано немає. */
export async function runCommand<I, O>(
  db: ActorDb,
  def: OperationDef<I, O>,
  raw: unknown,
): Promise<O> {
  const tails: (() => Promise<void>)[] = [];
  const ctx: OperationContext = {
    subject: { userId: null, roles: ['admin'] },
    actor: { kind: 'system' },
    db,
    afterCommit: (fn) => tails.push(fn),
  };
  const out = await def.run(ctx, def.input.parse(raw));
  if (tails.length > 0)
    throw new Error(
      `[showcase] ${def.id}: сід не мусить мати хвостів після коміту`,
    );
  return out;
}
