/**
 * Верхня межа суфіксів: предикат, що вічно відповідає «зайнято» (помилка
 * викликача), інакше повісив би запит; 100 000 однойменних сутностей поза
 * реальністю каталогу.
 */
const MAX_SUFFIX = 100_000;

/**
 * Вільний slug: `base`, а коли зайнято — `base-2`, `base-3`… (І18). Детермінований:
 * однакові `base` і стан реєстру дають однаковий результат, тож пакетне
 * заповнення адрес ідемпотентне. Зайнятість визначає викликач (реєстр адрес чи
 * токенів, у тому числі історичні рядки).
 */
export function allocateSlug(
  base: string,
  isTaken: (candidate: string) => boolean,
): string {
  if (!isTaken(base)) return base;
  for (let n = 2; n <= MAX_SUFFIX; n += 1) {
    const candidate = `${base}-${n}`;
    if (!isTaken(candidate)) return candidate;
  }
  throw new Error(
    `[domain/slugs] allocateSlug("${base}"): усі суфікси до ${MAX_SUFFIX} зайняті`,
  );
}
