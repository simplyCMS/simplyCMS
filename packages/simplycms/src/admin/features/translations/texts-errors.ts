import { useRef, useState } from 'react';

/**
 * Шлях проблеми сервера `texts.<мова>.<поле>` → ім'я поля форми (`null` —
 * шлях не про текст). Мова з імені визначає вкладку, яку треба показати.
 */
export function textsErrorField(
  path: readonly (string | number)[],
): string | null {
  return path[0] === 'texts' && path.length === 3
    ? `texts.${path[1]}.${path[2]}`
    : null;
}

/** Мова вкладки з імені поля `texts.<мова>.<поле>`. */
export function textsErrorLocale(name: string): string | null {
  return /^texts\.([^.]+)\./.exec(name)?.[1] ?? null;
}

/**
 * Мови, у полях яких сервер знайшов помилку: вкладка позначається, а на першу
 * помилку картка перемикається (інакше поле неактивної мови не видно).
 */
export function useTextErrors() {
  const focused = useRef(false);
  const [errorLocales, setLocales] = useState<ReadonlySet<string>>(new Set());
  return {
    errorLocales,
    noteTextError: (name: string, focus: (locale: string) => void) => {
      const locale = textsErrorLocale(name);
      if (!locale) return;
      setLocales((p) => new Set([...p, locale]));
      if (!focused.current) {
        focused.current = true;
        focus(locale);
      }
    },
    reset: () => {
      setLocales(new Set());
      focused.current = false;
    },
  };
}
