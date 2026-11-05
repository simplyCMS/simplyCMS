// Спільний SQL-літерал фікстур харнесу: його беруть і граф товару, і загальна
// фабрика рядків, тож він живе окремо від обох.

/** SQL-літерал тексту (одинарні лапки подвоюються); `null`/`undefined` → `null`. */
export const lit = (v: string | number | boolean | null | undefined): string =>
  v === null || v === undefined
    ? 'null'
    : typeof v === 'string'
      ? `'${v.replaceAll("'", "''")}'`
      : String(v);
