import { useT } from 'simplycms/i18n';
import type { UserCategory } from 'simplycms/schema/types';
import { Button } from 'simplycms/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'simplycms/ui/select';
import { Trash2 } from 'lucide-react';
import {
  CATEGORY_OPERATORS,
  CONDITION_LABEL,
  isBuiltInCondition,
  NUMERIC_OPERATORS,
} from './condition-catalog';
import { ConditionValueEditor } from './ConditionValueEditor';
import type { FormCondition } from './discount-form-schema';

interface Props {
  readonly condition: FormCondition;
  readonly categories: readonly UserCategory[];
  /** Умова не пройшла реєстр — показати причину під рядком. */
  readonly invalid: boolean;
  readonly onChange: (next: FormCondition) => void;
  readonly onRemove: () => void;
}

/**
 * Рядок умови за реєстром (Е6в-4). Тип, якого реєстр не знає (умова
 * плагіна, що зник, чи сміття в БД), — лише текст і кнопка видалення:
 * редактора для нього немає, а зберегти його сервер однаково не дасть.
 */
export function ConditionRow({
  condition,
  categories,
  invalid,
  onChange,
  onRemove,
}: Props) {
  const t = useT();
  const type = condition.conditionType;
  const known = isBuiltInCondition(type);
  const operators = !known
    ? []
    : type === 'user_category'
      ? CATEGORY_OPERATORS.map((o) => ({ value: o.value, text: t(o.key) }))
      : type === 'user_logged_in'
        ? []
        : NUMERIC_OPERATORS;
  return (
    <div className="space-y-1 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">
          {known
            ? t(CONDITION_LABEL[type])
            : t('admin.discounts.unknownCondition', { type })}
        </span>
        {operators.length > 0 && (
          <Select
            value={condition.operator}
            onValueChange={(op) =>
              op !== '' && onChange({ ...condition, operator: op })
            }
          >
            <SelectTrigger
              className="w-28"
              aria-label={t('admin.discounts.conditionOperator')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {operators.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.text}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {known && (
          <ConditionValueEditor
            type={type}
            value={condition.value}
            categories={categories}
            onChange={(value) => onChange({ ...condition, value })}
          />
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-auto"
          aria-label={t('admin.discounts.removeCondition')}
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      {invalid && (
        <p role="alert" className="text-xs text-destructive">
          {known
            ? t('admin.discounts.conditionInvalid')
            : t('admin.discounts.unknownConditionBlocks')}
        </p>
      )}
    </div>
  );
}
