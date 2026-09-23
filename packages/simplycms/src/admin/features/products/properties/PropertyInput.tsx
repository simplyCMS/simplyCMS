import { useT } from 'simplycms/i18n';
import { Input } from 'simplycms/ui/input';
import { Switch } from 'simplycms/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'simplycms/ui/select';
import type { PropertyOption, SectionProperty } from 'simplycms/schema/types';
import { ColorPropertyInput } from './ColorPropertyInput';
import { MultiselectPropertyInput } from './MultiselectPropertyInput';
import { NumberPropertyInput } from './NumberPropertyInput';
import type { PropertyValueDraft } from './usePropertyValues';

interface ValueRowLike {
  readonly value: string | null;
  readonly numericValue: string | null;
  readonly optionId: string | null;
}

interface Props {
  readonly property: SectionProperty;
  readonly options: readonly PropertyOption[];
  /** Рядок(и) цієї властивості: 0/1 для скаляра, N для multiselect. */
  readonly rows: readonly ValueRowLike[];
  readonly onChange: (v: PropertyValueDraft) => void;
  readonly onMultiChange: (optionIds: string[]) => void;
}

/**
 * Контрол значення властивості (Task 10, Step 3) — перемикач по
 * `propertyType`, розмітка легасі `ProductPropertyValues.tsx:323-449`.
 * Id контролу — `prop-<propertyId>`; `number`/`range`, `multiselect` і
 * `color` — окремі компоненти (канон 150 рядків).
 */
export function PropertyInput({
  property,
  options,
  rows,
  onChange,
  onMultiChange,
}: Props) {
  const t = useT();
  const id = `prop-${property.id}`;
  const current = rows[0];

  switch (property.propertyType) {
    case 'number':
    case 'range':
      return (
        <NumberPropertyInput
          id={id}
          value={current?.numericValue ?? null}
          onChange={onChange}
        />
      );

    case 'select':
      return (
        <Select
          value={current?.optionId ?? ''}
          onValueChange={(val) => {
            const opt = options.find((o) => o.id === val);
            onChange({
              value: opt?.name ?? null,
              numericValue: null,
              optionId: val,
            });
          }}
        >
          <SelectTrigger id={id}>
            <SelectValue placeholder={t('admin.properties.values.pickValue')} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>
                {opt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case 'multiselect':
      return (
        <MultiselectPropertyInput
          id={id}
          options={options}
          selectedOptionIds={
            new Set(rows.map((r) => r.optionId).filter((v): v is string => !!v))
          }
          onChange={onMultiChange}
        />
      );

    case 'boolean':
      return (
        <div className="flex items-center gap-2">
          <Switch
            id={id}
            checked={current?.value === 'true'}
            onCheckedChange={(checked) =>
              onChange({
                value: checked ? 'true' : 'false',
                numericValue: null,
                optionId: null,
              })
            }
          />
          <span className="text-sm text-muted-foreground">
            {current?.value === 'true' ? t('common.yes') : t('common.no')}
          </span>
        </div>
      );

    case 'color':
      return (
        <ColorPropertyInput
          value={current?.value ?? null}
          onChange={onChange}
        />
      );

    // 'text' і незнаний тип (fallback легасі) — просте текстове поле.
    case 'text':
    default:
      return (
        <Input
          id={id}
          value={current?.value ?? ''}
          onChange={(e) =>
            onChange({
              value: e.target.value || null,
              numericValue: null,
              optionId: null,
            })
          }
          placeholder={t('admin.properties.values.inputPlaceholder', {
            name: property.name.toLowerCase(),
          })}
        />
      );
  }
}
