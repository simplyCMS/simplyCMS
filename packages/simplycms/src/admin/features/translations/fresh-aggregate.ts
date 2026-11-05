/**
 * Агрегат із результату `query.refetch()` — лише коли перечитування вдалося. TanStack при збої
 * лишає ПОПЕРЕДНІ `data`, тож без цієї перевірки перезавантаження конфлікту підставило б
 * застарілий знімок і тихо закрило діалог; `undefined` змушує хук показати «не вдалося завантажити».
 */
export function freshAggregate<T>(result: {
  readonly status: string;
  readonly data: T | undefined;
}): T | undefined {
  return result.status === 'success' ? result.data : undefined;
}
