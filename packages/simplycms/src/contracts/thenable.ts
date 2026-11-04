/**
 * Проміс із полями thenable-протоколу React (`status`/`value`/`reason`).
 * Коли проміс уже `fulfilled`, React `use()` розгортає значення СИНХРОННО, без suspend —
 * це усуває «висіння» компонента під час гідрації. Спільний для реєстру тем і реєстру
 * каталогів мови (Д5): протокол один, тож і анотація одна.
 */
export type ReactThenable<T> = Promise<T> & {
  status?: 'pending' | 'fulfilled' | 'rejected';
  value?: T;
  reason?: unknown;
};

/**
 * Позначає проміс полями протоколу й повертає ТОЙ САМИЙ проміс (не нову обгортку):
 * React `use()` вимагає стабільну референцію між рендерами.
 */
export function trackThenable<T>(promise: Promise<T>): ReactThenable<T> {
  const tracked: ReactThenable<T> = promise;
  tracked.status = 'pending';
  tracked.then(
    (value) => {
      tracked.status = 'fulfilled';
      tracked.value = value;
    },
    (reason: unknown) => {
      tracked.status = 'rejected';
      tracked.reason = reason;
    },
  );
  return tracked;
}
