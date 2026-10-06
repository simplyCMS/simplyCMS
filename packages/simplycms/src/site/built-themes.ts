/**
 * Вшиті теми, про які серверу повідомляє host (`src/server.ts`).
 *
 * Без декларації набір порожній, і `isBuiltTheme` відмовляє: активація теми
 * закрита за замовчуванням (fail-closed). Перевіряти за рядком `themes` не
 * можна — рядок лишається після видалення пакета теми.
 */
let builtThemes: ReadonlySet<string> = new Set();

/** Задати набір вшитих тем; повторний виклик ЗАМІНЮЄ набір. */
export function declareBuiltThemes(names: readonly string[]): void {
  builtThemes = new Set(names);
}

export function isBuiltTheme(name: string): boolean {
  return builtThemes.has(name);
}
