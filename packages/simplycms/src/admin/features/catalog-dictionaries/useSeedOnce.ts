import { useEffect, useRef } from 'react';

/**
 * Засіяти форму рядком лише при ПЕРШОМУ надходженні ключа (зазвичай id).
 *
 * Чому не `useEffect(reset, [row?.id])`: оптимістичне видалення прибирає
 * рядок із колекції, а відмова сервера повертає його — id стає `undefined`
 * і знову тим самим, ефект спрацьовує і затирає несохранене введення.
 * Тут повернення того самого ключа — no-op; `undefined` (рядка немає) теж.
 */
export function useSeedOnce(key: string | undefined, seed: () => void) {
  const seeded = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (key === undefined || seeded.current === key) return;
    seeded.current = key;
    seed();
  });
}
