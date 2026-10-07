/**
 * Групи, які можна обрати батьком для `selfId`: без самої групи й без
 * УСЬОГО її піддерева (Е6в-17) — інакше власник збудував би цикл, і сервер
 * відмовив би `discount_group_cycle` уже після натискання «Зберегти».
 * Цикл у даних не зациклює обхід: кожна група блокується один раз.
 */
export function parentOptions<
  T extends { readonly id: string; readonly parentGroupId: string | null },
>(groups: readonly T[], selfId: string | undefined): T[] {
  if (!selfId) return [...groups];
  const blocked = new Set([selfId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const g of groups)
      if (
        g.parentGroupId !== null &&
        blocked.has(g.parentGroupId) &&
        !blocked.has(g.id)
      ) {
        blocked.add(g.id);
        grew = true;
      }
  }
  return groups.filter((g) => !blocked.has(g.id));
}
