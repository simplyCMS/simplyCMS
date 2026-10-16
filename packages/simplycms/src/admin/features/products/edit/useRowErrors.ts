import { useState } from 'react';

type Errors = Readonly<Record<string, string>>;

/** Серверні помилки рядків картки (модифікації, значення властивостей), що не мають поля форми. */
export function useRowErrors() {
  const [modificationErrors, setMods] = useState<Errors>({});
  const [valueErrors, setValues] = useState<Errors>({});
  return {
    modificationErrors,
    valueErrors,
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
    },
  };
}
