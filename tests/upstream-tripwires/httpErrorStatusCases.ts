/**
 * Єдина таблиця кейсів предиката «HTTP-помилка» для `START-ENTRY-1`: її читають і
 * тест `httpErrorStatus` (наш шар), і поведінкова розтяжка (справжній
 * `createServerEntry`). Один список — розбіжність нашого предиката з upstream не
 * може сховатись у тому, що одна зі сторін перевіряє менше за іншу.
 *
 * `status` — що очікуємо як статус відповіді Start на такий виняток entry:
 * ціле 400..599 — Start віддає його як є; `undefined` — помилка не «HTTP»
 * (Start відповідає 500 і не дає ref).
 */
export type HttpErrorStatusCase = {
  readonly name: string;
  /** Свіжа помилка на кожен виклик: тести не діляться станом. */
  readonly make: () => unknown;
  readonly status: number | undefined;
};

const withProps = (props: Record<string, unknown>) => () =>
  Object.assign(new Error('case'), props);

export const HTTP_ERROR_STATUS_CASES: readonly HttpErrorStatusCase[] = [
  { name: 'status 404', make: withProps({ status: 404 }), status: 404 },
  { name: 'statusCode 413', make: withProps({ statusCode: 413 }), status: 413 },
  {
    name: 'cause.status 502',
    make: () => new Error('case', { cause: { status: 502 } }),
    status: 502,
  },
  {
    name: 'cause.statusCode 503',
    make: () => new Error('case', { cause: { statusCode: 503 } }),
    status: 503,
  },
  {
    name: 'числовий рядок "413"',
    make: withProps({ statusCode: '413' }),
    status: 413,
  },
  { name: 'межа 399', make: withProps({ status: 399 }), status: undefined },
  { name: 'межа 400', make: withProps({ status: 400 }), status: 400 },
  { name: 'межа 499', make: withProps({ status: 499 }), status: 499 },
  { name: 'межа 500', make: withProps({ status: 500 }), status: 500 },
  { name: 'межа 599', make: withProps({ status: 599 }), status: 599 },
  { name: 'межа 600', make: withProps({ status: 600 }), status: undefined },
  { name: 'межа 200', make: withProps({ status: 200 }), status: undefined },
  { name: 'редирект 302', make: withProps({ status: 302 }), status: undefined },
  { name: 'дробове 4.5', make: withProps({ status: 4.5 }), status: undefined },
  {
    name: 'нечисловий рядок',
    make: withProps({ status: 'abc' }),
    status: undefined,
  },
  { name: 'status null', make: withProps({ status: null }), status: undefined },
  { name: 'звичайна помилка', make: () => new Error('x'), status: undefined },
  { name: 'рядок замість помилки', make: () => 'text', status: undefined },
  { name: 'null замість помилки', make: () => null, status: undefined },
];
