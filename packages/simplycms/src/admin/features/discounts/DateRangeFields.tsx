import type { UseFormRegisterReturn } from 'react-hook-form';
import { useT } from 'simplycms/i18n';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';

interface Props {
  readonly idPrefix: string;
  readonly from: UseFormRegisterReturn;
  readonly to: UseFormRegisterReturn;
  /** Кінець не пізніше за початок. */
  readonly invalid: boolean;
}

/**
 * Пара `datetime-local` для групи й знижки. Рядок поля — локальний час
 * браузера (Е6в-22); у `Date` його переводить хук картки, а не поле.
 */
export function DateRangeFields({ idPrefix, from, to, invalid }: Props) {
  const t = useT();
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-from`}>{t('common.dateFrom')}</Label>
          <Input id={`${idPrefix}-from`} type="datetime-local" {...from} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-to`}>{t('common.dateTo')}</Label>
          <Input
            id={`${idPrefix}-to`}
            type="datetime-local"
            aria-invalid={invalid}
            {...to}
          />
        </div>
      </div>
      {invalid && (
        <p role="alert" className="text-xs text-destructive">
          {t('admin.errors.discountGroupDatesInvalid')}
        </p>
      )}
    </div>
  );
}
