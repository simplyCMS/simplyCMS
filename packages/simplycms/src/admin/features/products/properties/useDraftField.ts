import { useEffect, useRef, useState } from 'react';

interface Options {
  readonly value: string | null;
  /** «Чи змінилось» — компаратор чернетки з поточним значенням колекції. */
  readonly isChanged: (draft: string, value: string | null) => boolean;
  readonly onSave: (draft: string) => void;
}

interface DraftField {
  readonly draft: string;
  readonly setDraft: (v: string) => void;
  readonly onFocus: () => void;
  readonly onBlur: () => void;
  readonly onEnter: () => void;
}

/**
 * Чернетка текстового/числового поля зі збереженням на blur/Enter
 * (Е3-19а) — спільна для `TextPropertyInput` і `NumberPropertyInput`: поле
 * тримає ЛОКАЛЬНУ чернетку, поки має фокус; write-back із колекції
 * записується в поле лише коли фокусу НЕМАЄ (`focused` — стан, не ref:
 * `react-hooks/refs` забороняє читати ref ПІД ЧАС рендеру, а це саме
 * рендер-гілка). Незмінене — жодної мутації (`isChanged`). Дебаунсу не
 * треба; розмонтування з незбереженою чернеткою — flush у cleanup
 * ефекту (навігація без blur не губить ввід).
 */
export function useDraftField({
  value,
  isChanged,
  onSave,
}: Options): DraftField {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [prevValue, setPrevValue] = useState(value);

  // Оновлення СТАНУ ПІД ЧАС рендеру (не `useEffect`) — той самий патерн,
  // що був у `NumberPropertyInput` до Е3-19.
  if (!focused && value !== prevValue) {
    setPrevValue(value);
    setDraft(value ?? '');
  }

  // `react-hooks/refs`: ref не можна читати/писати ПІД ЧАС рендеру —
  // «останній знімок» для cleanup-ефекту оновлюється в ефекті БЕЗ deps
  // (виконується після КОЖНОГО рендеру, до фактичного unmount).
  const latest = useRef({ draft, value, isChanged, onSave });
  useEffect(() => {
    latest.current = { draft, value, isChanged, onSave };
  });

  const flush = () => {
    const l = latest.current;
    if (l.isChanged(l.draft, l.value)) l.onSave(l.draft);
  };

  useEffect(() => () => flush(), []);

  return {
    draft,
    setDraft,
    onFocus: () => setFocused(true),
    onBlur: () => {
      setFocused(false);
      flush();
    },
    onEnter: flush,
  };
}
