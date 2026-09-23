import { Input } from 'simplycms/ui/input';
import type { PropertyValueDraft } from './usePropertyValues';

interface Props {
  readonly value: string | null;
  readonly onChange: (v: PropertyValueDraft) => void;
}

/** Колір — винесений з `PropertyInput` (канон 150 рядків): пікер + hex-поле. */
export function ColorPropertyInput({ value, onChange }: Props) {
  const set = (v: string | null) =>
    onChange({ value: v, numericValue: null, optionId: null });

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value || '#000000'}
        onChange={(e) => set(e.target.value)}
        className="h-10 w-20 rounded border cursor-pointer"
      />
      <Input
        value={value ?? ''}
        onChange={(e) => set(e.target.value || null)}
        placeholder="#000000"
        className="w-32"
      />
    </div>
  );
}
