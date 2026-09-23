import { Input } from 'simplycms/ui/input';
import type { PropertyValueDraft } from './usePropertyValues';
import { useDraftField } from './useDraftField';

interface Props {
  readonly id: string;
  readonly value: string | null;
  readonly placeholder: string;
  readonly onChange: (v: PropertyValueDraft) => void;
}

/**
 * Текстове поле властивості (`text`, fallback легасі) — Е3-19а: збереження
 * на blur/Enter, НЕ на кожну клавішу. Чернетка — `useDraftField`; «чи
 * змінилось» — після trim.
 */
export function TextPropertyInput({ id, value, placeholder, onChange }: Props) {
  const { draft, setDraft, onFocus, onBlur, onEnter } = useDraftField({
    value,
    isChanged: textChanged,
    onSave: (raw) =>
      onChange({
        value: raw.trim() || null,
        numericValue: null,
        optionId: null,
      }),
  });

  return (
    <Input
      id={id}
      value={draft}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onEnter();
      }}
      onChange={(e) => setDraft(e.target.value)}
      placeholder={placeholder}
    />
  );
}

function textChanged(draft: string, value: string | null): boolean {
  return draft.trim() !== (value ?? '').trim();
}
