import { useRef, useState } from 'react';
import { useT } from 'simplycms/i18n';
import { Input } from 'simplycms/ui/input';

/** Межі кількості позиції (Е5б-9) — ті самі, що на сервері. */
export const QTY_MIN = 1;
export const QTY_MAX = 9999;

interface Props {
  readonly quantity: number;
  readonly name: string;
  /** Зберігає зміну; `true` — збережено (значення прийде write-back-ом). */
  readonly onCommit: (quantity: number) => Promise<boolean>;
}

/**
 * Поле кількості: підтвердження Enter/blur. `draft === null` — показуємо
 * серверне значення, тож і після успіху (write-back), і після відмови (409,
 * межі) поле саме повертається до істини сервера. Поки запит у польоті —
 * повторного надсилання немає.
 */
export function OrderItemQuantity({ quantity, name, onCommit }: Props) {
  const t = useT();
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Гвард польоту — ref, не стан: Enter і blur можуть прийти в одному
  // батчі React, до ререндеру з `busy = true`.
  const inFlight = useRef(false);

  const commit = async () => {
    if (inFlight.current || draft === null) return;
    const n = Number(draft);
    const valid =
      draft.trim() !== '' &&
      Number.isInteger(n) &&
      n >= QTY_MIN &&
      n <= QTY_MAX;
    if (!valid || n === quantity) return setDraft(null);
    inFlight.current = true;
    setBusy(true);
    try {
      await onCommit(n);
    } finally {
      inFlight.current = false;
      setDraft(null);
      setBusy(false);
    }
  };

  return (
    <Input
      type="number"
      inputMode="numeric"
      min={QTY_MIN}
      max={QTY_MAX}
      step={1}
      className="mx-auto w-20 text-center"
      aria-label={`${t('common.quantity')}: ${name}`}
      value={draft ?? String(quantity)}
      disabled={busy}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') void commit();
      }}
    />
  );
}
