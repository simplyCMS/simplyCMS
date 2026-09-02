import { useQueryClient, type QueryClient } from '@tanstack/react-query';

/**
 * Реєстр колекцій, ключований QueryClient (патерн business-scope з
 * офіційного query-adapter.md). WeakMap, не singleton: на сервері кожен
 * запит має власний QueryClient (Е1а), спільний інстанс протік би між
 * користувачами; WeakMap заразом прибирає записи разом із клієнтом.
 *
 * 🔴 Generic C зберігає конкретний тип колекції наскрізь — типізовані
 * рядки в useLiveQuery і typed utils (стирання через
 * ReturnType<typeof createCollection> — дефект старої редакції).
 */
export interface CollectionDef<C> {
  readonly id: string;
  readonly create: (queryClient: QueryClient) => C;
}

const byClient = new WeakMap<QueryClient, Map<string, unknown>>();

export function getCollection<C>(
  client: QueryClient,
  def: CollectionDef<C>,
): C {
  let byId = byClient.get(client);
  if (!byId) byClient.set(client, (byId = new Map()));
  let collection = byId.get(def.id) as C | undefined;
  if (!collection) byId.set(def.id, (collection = def.create(client)));
  return collection;
}

/** Хук-обгортка: клієнт із контексту. Інстанс стабільний у межах клієнта. */
export function useCollection<C>(def: CollectionDef<C>): C {
  return getCollection(useQueryClient(), def);
}
