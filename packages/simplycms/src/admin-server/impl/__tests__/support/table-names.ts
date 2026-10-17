// Імена, під якими таблицю Drizzle видно в модулі (М1, Task 14, сканери порядку замків):
// сам ідентифікатор, `schema.<ідентифікатор>`, локальний аліас (`const m = productModifications`)
// та імпорт-аліас (`import { productModifications as pm }`). Сканер, що знає лише перше,
// пропускав би видаляч чи замок, записаний через аліас.

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Регулярні вирази-джерела імен таблиці `ident` у файлі `src` (без якорів). */
export function tableNames(src: string, ident: string): string[] {
  const names = new Set<string>([`(?:\\w+\\.)?${ident}`]);
  const local = new RegExp(
    `(?:const|let|var)\\s+(\\w+)\\s*=\\s*(?:\\w+\\.)?${ident}\\b`,
    'g',
  );
  for (const [, alias] of src.matchAll(local)) names.add(escape(alias!));
  const imported = new RegExp(`\\b${ident}\\s+as\\s+(\\w+)`, 'g');
  for (const [, alias] of src.matchAll(imported)) names.add(escape(alias!));
  return [...names];
}
