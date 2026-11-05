import { useState } from 'react';
import { useTextErrors } from '../../translations/texts-errors';

type Errors = Readonly<Record<string, string>>;

/** Серверні помилки рядків картки (модифікації, значення властивостей), що не мають поля форми. */
export function useRowErrors() {
  const [modificationErrors, setMods] = useState<Errors>({});
  const [valueErrors, setValues] = useState<Errors>({});
  const textErrors = useTextErrors();
  return {
    modificationErrors,
    valueErrors,
    errorLocales: textErrors.errorLocales,
    /** Помилка `texts.<мова>.<поле>`: позначає вкладку й перемикає на першу помилку. */
    noteTextError: textErrors.noteTextError,
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
      textErrors.reset();
    },
  };
}
