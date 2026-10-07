import { useWatch, type UseFormReturn } from 'react-hook-form';
import { CATEGORY_RULE_FIELD_OPERATORS } from 'simplycms/domain/user-categories';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { Input } from 'simplycms/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'simplycms/ui/select';
import { Trash2 } from 'lucide-react';
import type {
  CategoryRuleFormInput,
  CategoryRuleFormValues,
} from './category-rule-form-schema';
import { fieldMeta, operatorLabel, RULE_FIELDS } from './rule-field-catalog';

interface Props {
  readonly form: UseFormReturn<
    CategoryRuleFormInput,
    unknown,
    CategoryRuleFormValues
  >;
  readonly index: number;
  readonly onRemove: () => void;
}

/**
 * Рядок умови: поле → оператор (лише з `CATEGORY_RULE_FIELD_OPERATORS` цього
 * поля) → значення. Біля UTM-полів — підказка З-6: мітки поки не збираються.
 */
export function RuleConditionRow({ form, index, onRemove }: Props) {
  const t = useT();
  const { control, register, setValue } = form;
  const base = `conditions.rules.${index}` as const;
  const field = useWatch({ control, name: `${base}.field` });
  const operator = useWatch({ control, name: `${base}.operator` });
  const meta = fieldMeta(field);
  const operators = meta ? CATEGORY_RULE_FIELD_OPERATORS[meta.value] : [];
  return (
    <div className="space-y-2 rounded-lg border p-4">
      <div className="flex items-start gap-2">
        <Select
          value={field}
          onValueChange={(v) => {
            const next = fieldMeta(v);
            if (!next) return;
            setValue(`${base}.field`, v);
            setValue(
              `${base}.operator`,
              CATEGORY_RULE_FIELD_OPERATORS[next.value][0]!,
            );
          }}
        >
          <SelectTrigger aria-label={t('admin.users.rules.field')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RULE_FIELDS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {t(f.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={operator}
          onValueChange={(v) => v !== '' && setValue(`${base}.operator`, v)}
        >
          <SelectTrigger
            className="w-40"
            aria-label={t('admin.users.rules.operator')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operators.map((op) => {
              const label = operatorLabel(op, !!meta?.numeric);
              return (
                <SelectItem key={op} value={op}>
                  {'key' in label ? t(label.key) : label.text}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <Input
          type={meta?.numeric ? 'number' : 'text'}
          step="any"
          aria-label={t('common.value')}
          placeholder={t('common.value')}
          {...register(`${base}.value`)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('admin.customerCategories.rules.removeCondition')}
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      {meta?.utm && (
        <p className="text-xs text-muted-foreground">
          {t('admin.customerCategories.rules.utmHint')}
        </p>
      )}
    </div>
  );
}
