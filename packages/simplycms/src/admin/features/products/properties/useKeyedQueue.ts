import { useRef } from 'react';

/**
 * Черга промісів на довільний ключ (Е3-19б, `usePropertyValues`):
 * наступна операція для ключа стартує ЛИШЕ ПІСЛЯ `isPersisted` (або
 * відхилення) попередньої — паралельні авто-транзакції `@tanstack/db`
 * інакше могли виконатись у будь-якому порядку (update випереджає insert
 * того самого рядка). Відхилення однієї операції НЕ блокує чергу —
 * `onError` звітує тут, раз на операцію, а не в кожному виклику.
 *
 * `tails` — ref (не state): черга не впливає на рендер, а мутація мапи
 * відбувається лише всередині `enqueue`, викликаного з обробників подій,
 * НІКОЛИ під час самого рендеру (`react-hooks/refs` це й гарантує).
 */
export function useKeyedQueue(
  onError: (e: unknown) => void,
): (key: string, run: () => Promise<void>) => void {
  const tails = useRef(new Map<string, Promise<void>>());
  return (key, run) => {
    const prevTail = tails.current.get(key) ?? Promise.resolve();
    const runReported = () => run().catch(onError);
    tails.current.set(key, prevTail.then(runReported, runReported));
  };
}
