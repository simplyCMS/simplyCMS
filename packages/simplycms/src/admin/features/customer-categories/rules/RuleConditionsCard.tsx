import { useFieldArray, type UseFormReturn } from 'react-hook-form';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'simplycms/ui/select';
import { Plus } from 'lucide-react';
import type {
  CategoryRuleFormInput,
  CategoryRuleFormValues,
} from './category-rule-form-schema';
import { RuleConditionRow } from './RuleConditionRow';

interface Props {
  readonly form: UseFormReturn<
    CategoryRuleFormInput,
    unknown,
    CategoryRuleFormValues
  >;
}

/** Картка умов: режим «усі»/«будь-яка» і список умов (порожній — невалідний). */
export function RuleConditionsCard({ form }: Props) {
  const t = useT();
  const { control, setValue, watch } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'conditions.rules',
  });
  const mode = watch('conditions.type');
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{t('admin.users.rules.conditions')}</CardTitle>
        <Select
          value={mode}
          onValueChange={(v) => setValue('conditions.type', v as 'all' | 'any')}
        >
          <SelectTrigger
            className="w-52"
            aria-label={t('admin.users.rules.conditions')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t('admin.users.rules.allConditions')}
            </SelectItem>
            <SelectItem value="any">
              {t('admin.users.rules.anyCondition')}
            </SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.length === 0 && (
          <p className="py-4 text-center text-muted-foreground">
            {t('admin.users.rules.addAtLeastOne')}
          </p>
        )}
        {fields.map((item, index) => (
          <RuleConditionRow
            key={item.id}
            form={form}
            index={index}
            onRemove={() => remove(index)}
          />
        ))}
        {form.formState.errors.conditions && (
          <p role="alert" className="text-xs text-destructive">
            {t('admin.customerCategories.rules.conditionsInvalid')}
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            append({ field: 'total_purchases', operator: '>=', value: '' })
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          {t('admin.users.rules.addCondition')}
        </Button>
      </CardContent>
    </Card>
  );
}
