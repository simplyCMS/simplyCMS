import { Input } from 'simplycms/ui/input';
import type { PropertyValueDraft } from './usePropertyValues';
import { useDraftField } from './useDraftField';

interface Props {
  readonly id: string;
  readonly value: string | null;
  readonly onChange: (v: PropertyValueDraft) => void;
}

/**
 * Числове поле властивості (`number`/`range`) — Е3-19а: збереження на
 * blur/Enter, НЕ на кожну клавішу (write-back "1.0000" посеред набору
 * "15" переписував би чернетку). Чернетка — `useDraftField`; «чи
 * змінилось» — числове порівняння, порожнє ↔ null. Невалідне/нескінченне
 * — НЕ зберігається, лише підсвічується бордюром.
 */
export function NumberPropertyInput({ id, value, onChange }: Props) {
  const { draft, setDraft, onFocus, onBlur, onEnter } = useDraftField({
    value,
    isChanged: numChanged,
    onSave: (raw) => {
      if (raw === '') {
        onChange({ value: null, numericValue: null, optionId: null });
        return;
      }
      const s = String(Number(raw));
      onChange({ value: s, numericValue: s, optionId: null });
    },
  });
  const invalid = draft !== '' && !Number.isFinite(Number(draft));

  return (
    <Input
      id={id}
      type="number"
      value={draft}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onEnter();
      }}
      onChange={(e) => setDraft(e.target.value)}
      className={invalid ? 'border-destructive' : undefined}
      placeholder="0"
    />
  );
}

function numChanged(draft: string, value: string | null): boolean {
  const num = draft === '' ? null : Number(draft);
  if (num !== null && !Number.isFinite(num)) return false; // невалідне — не зберігати
  const cur = value === null || value === '' ? null : Number(value);
  return num !== cur;
}
