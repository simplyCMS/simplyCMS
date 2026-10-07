import { useLiveQuery } from '@tanstack/react-db';
import { useWatch } from 'react-hook-form';
import { userCategoriesCollection, useCollection } from 'simplycms/admin-data';
import { BUILT_IN_DISCOUNT_CONDITIONS } from 'simplycms/domain/discounts';
import { useT } from 'simplycms/i18n';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'simplycms/ui/select';
import {
  CONDITION_LABEL,
  defaultCondition,
  isBuiltInCondition,
} from './condition-catalog';
import { ConditionRow } from './ConditionRow';
import type { FormCondition } from './discount-form-schema';
import type { DiscountForm } from './useDiscountCard';

/** Умови знижки: рядок на умову, додавання — вибором вбудованого типу. */
export function DiscountConditionsCard({
  form,
}: {
  readonly form: DiscountForm;
}) {
  const t = useT();
  const categoriesCol = useCollection(userCategoriesCollection);
  const { data: categories } = useLiveQuery({
    query: (q) =>
      q.from({ c: categoriesCol }).orderBy(({ c }) => c.name, 'asc'),
  });
  const conditions = useWatch({ control: form.control, name: 'conditions' });
  const errors = form.formState.errors.conditions;
  const write = (next: FormCondition[]) =>
    form.setValue('conditions', next, {
      shouldDirty: true,
      // До першої спроби зберегти помилки не показуємо; після — живо.
      shouldValidate: form.formState.isSubmitted,
    });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t('admin.discounts.conditions')}</CardTitle>
        <Select
          value=""
          onValueChange={(type) =>
            isBuiltInCondition(type) &&
            write([...conditions, defaultCondition(type)])
          }
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder={t('admin.discounts.addCondition')} />
          </SelectTrigger>
          <SelectContent>
            {BUILT_IN_DISCOUNT_CONDITIONS.map((type) => (
              <SelectItem key={type} value={type}>
                {t(CONDITION_LABEL[type])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-3">
        {conditions.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t('admin.discounts.noConditions')}
          </p>
        )}
        {conditions.map((c, i) => (
          <ConditionRow
            key={i}
            condition={c}
            categories={categories}
            invalid={!!errors?.[i]}
            onChange={(next) =>
              write(conditions.map((old, j) => (j === i ? next : old)))
            }
            onRemove={() => write(conditions.filter((_, j) => j !== i))}
          />
        ))}
      </CardContent>
    </Card>
  );
}
