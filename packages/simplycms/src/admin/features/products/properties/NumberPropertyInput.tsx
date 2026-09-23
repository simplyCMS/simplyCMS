import { useState } from 'react';
import { Input } from 'simplycms/ui/input';
import type { PropertyValueDraft } from './usePropertyValues';

interface Props {
  readonly id: string;
  readonly value: string | null;
  readonly onChange: (v: PropertyValueDraft) => void;
}

/**
 * Числове поле властивості (`number`/`range`) — винесене з `PropertyInput`
 * (канон 150 рядків): локальний invalid-стан ДО збереження (Task 10, Step
 * 2). Нескінченне/`NaN` — НЕ зберігається, лише підсвічується бордюром;
 * порожнє поле зберігається як `null` (видаляє рядок у `saveScalar`).
 */
export function NumberPropertyInput({ id, value, onChange }: Props) {
  // Синхронізація з асинхронним `value` (on-demand колекція) — оновлення
  // стану ПІД ЧАС рендеру (React-легальний патерн, той самий, що легасі
  // сторінки адмінки), не `useEffect`: каскадний рендер без мережевого
  // ефекту не потрібен, а `react-hooks/set-state-in-effect` це й ловить.
  const [prevValue, setPrevValue] = useState(value);
  const [raw, setRaw] = useState(value ?? '');
  const [invalid, setInvalid] = useState(false);
  if (value !== prevValue) {
    setPrevValue(value);
    setRaw(value ?? '');
    setInvalid(false);
  }

  return (
    <Input
      id={id}
      type="number"
      value={raw}
      onChange={(e) => {
        const v = e.target.value;
        setRaw(v);
        if (v === '') {
          setInvalid(false);
          onChange({ value: null, numericValue: null, optionId: null });
          return;
        }
        const num = Number(v);
        if (!Number.isFinite(num)) {
          setInvalid(true);
          return;
        }
        setInvalid(false);
        const s = String(num);
        onChange({ value: s, numericValue: s, optionId: null });
      }}
      className={invalid ? 'border-destructive' : undefined}
      placeholder="0"
    />
  );
}
