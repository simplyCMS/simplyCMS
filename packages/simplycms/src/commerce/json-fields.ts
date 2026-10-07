// Читач JSON, що приходить зі сховища одним виразом (`json_build_object`):
// кожне поле перевіряється явно, а шлях у винятку каже, ЩО саме зламано.
// Невалідне значення — дефект даних, а не тиха підстановка.

export type Obj = Record<string, unknown>;

/** Текстова форма `numeric` у Postgres — без експоненти, `NaN` чи пробілів. */
const DECIMAL = /^-?\d+(\.\d+)?$/;

export function fail(path: string, value: unknown): never {
  throw new Error(
    `[simplycms/commerce] дані зі сховища: ${path} = ${JSON.stringify(value)} — дефект даних`,
  );
}

export const obj = (v: unknown, path: string): Obj =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Obj)
    : fail(path, v);
export const list = (v: unknown, path: string): unknown[] =>
  Array.isArray(v) ? v : fail(path, v);

/** Читач полів одного обʼєкта: шлях у винятку каже, ЩО саме зламано. */
export function fields(o: Obj, path: string) {
  const at = (k: string) => `${path}.${k}`;
  const str = (k: string) =>
    typeof o[k] === 'string' ? (o[k] as string) : fail(at(k), o[k]);
  const strOrNull = (k: string) => (o[k] === null ? null : str(k));
  const oneOf = <T extends string>(k: string, allowed: readonly T[]): T =>
    allowed.includes(o[k] as T) ? (o[k] as T) : fail(at(k), o[k]);
  return {
    str,
    strOrNull,
    oneOf,
    bool: (k: string) =>
      typeof o[k] === 'boolean' ? (o[k] as boolean) : fail(at(k), o[k]),
    int: (k: string) =>
      Number.isInteger(o[k]) ? (o[k] as number) : fail(at(k), o[k]),
    /** `timestamptz` у JSON — ISO-рядок зі зсувом; `Date` будується тут. */
    date: (k: string): Date | null => {
      const raw = strOrNull(k);
      if (raw === null) return null;
      const date = new Date(raw);
      return Number.isNaN(date.getTime()) ? fail(at(k), raw) : date;
    },
    /** `numeric` їде рядком і розбирається ЯВНО: сміття — виняток. */
    decimal: (k: string) => {
      const n = DECIMAL.test(str(k)) ? Number(o[k]) : NaN;
      // 400 цифр проходить regex, але `Number` дає Infinity.
      return Number.isFinite(n) ? n : fail(at(k), o[k]);
    },
  };
}
