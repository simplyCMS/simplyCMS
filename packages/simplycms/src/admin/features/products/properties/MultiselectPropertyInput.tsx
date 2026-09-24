import { useT } from 'simplycms/i18n';
import { Checkbox } from 'simplycms/ui/checkbox';
import { Label } from 'simplycms/ui/label';
import type { PropertyOption } from 'simplycms/schema/types';

interface Props {
  readonly id: string;
  readonly options: readonly PropertyOption[];
  readonly selectedOptionIds: ReadonlySet<string>;
  readonly onChange: (optionIds: string[]) => void;
}

/**
 * Multiselect — винесений з `PropertyInput` (канон 150 рядків). Рядок на
 * опцію (Е3-13): вихід — ПОВНИЙ бажаний набір `optionIds`,
 * `usePropertyValues.saveMulti` сам рахує вставки/видалення.
 */
export function MultiselectPropertyInput({
  id,
  options,
  selectedOptionIds,
  onChange,
}: Props) {
  const t = useT();

  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <div key={opt.id} className="flex items-center gap-2">
          <Checkbox
            id={`${id}-${opt.id}`}
            checked={selectedOptionIds.has(opt.id)}
            onCheckedChange={(checked) => {
              const next = new Set(selectedOptionIds);
              if (checked === true) next.add(opt.id);
              else next.delete(opt.id);
              onChange([...next]);
            }}
          />
          <Label htmlFor={`${id}-${opt.id}`} className="font-normal">
            {opt.name}
          </Label>
        </div>
      ))}
      {options.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t('admin.properties.values.noOptions')}
        </p>
      )}
    </div>
  );
}
