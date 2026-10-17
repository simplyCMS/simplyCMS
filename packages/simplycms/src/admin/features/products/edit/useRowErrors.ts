import { useRef, useState } from 'react';

type Errors = Readonly<Record<string, string>>;

/** Серверні помилки рядків картки (модифікації, значення властивостей), що не мають поля форми. */
export function useRowErrors() {
  const [modificationErrors, setMods] = useState<Errors>({});
  const [valueErrors, setValues] = useState<Errors>({});
  const focused = useRef(false);
  const [errorLocales, setLocales] = useState<ReadonlySet<string>>(new Set());
  return {
    modificationErrors,
    valueErrors,
    errorLocales,
    /**
     * Помилка поля `texts.<мова>.<поле>`: вкладку мови позначено, а на першу
     * помилку картка перемикається (інакше поле неактивної мови не видно).
     */
    noteTextError: (name: string, focus: (locale: string) => void) => {
      const locale = /^texts\.([^.]+)\./.exec(name)?.[1];
      if (!locale) return;
      setLocales((p) => new Set([...p, locale]));
      if (!focused.current) {
        focused.current = true;
        focus(locale);
      }
    },
    setModificationError: (id: string, message: string) =>
      setMods((p) => ({ ...p, [id]: message })),
    setValueError: (propertyId: string, message: string) =>
      setValues((p) => ({ ...p, [propertyId]: message })),
    clearValueError: (propertyId: string) =>
      setValues((p) => {
        if (!(propertyId in p)) return p;
        return Object.fromEntries(
          Object.entries(p).filter(([k]) => k !== propertyId),
        );
      }),
    reset: () => {
      setMods({});
      setValues({});
      setLocales(new Set());
      focused.current = false;
    },
  };
}
