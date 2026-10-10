import { Controller, type UseFormReturn } from 'react-hook-form';
import { useT } from 'simplycms/i18n';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Checkbox } from 'simplycms/ui/checkbox';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';
import { WEEKDAYS } from './banner-options';
import type { BannerFormInput, BannerFormValues } from './banner-form-schema';

interface Props {
  readonly form: UseFormReturn<BannerFormInput, unknown, BannerFormValues>;
}

const Err = ({ text }: { text?: string }) =>
  text ? (
    <p role="alert" className="text-xs text-destructive">
      {text}
    </p>
  ) : null;

/**
 * Розклад показу. Порожні дні = «щодня» (`null` на сервері); час —
 * `HH:MM`, дати — локальний час браузера (`datetime-local`).
 */
export function BannerScheduleCard({ form }: Props) {
  const t = useT();
  const { register, control, formState } = form;
  const { errors } = formState;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.banners.schedule')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="banner-date-from">{t('common.dateFrom')}</Label>
            <Input
              id="banner-date-from"
              type="datetime-local"
              {...register('dateFrom')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="banner-date-to">{t('common.dateTo')}</Label>
            <Input
              id="banner-date-to"
              type="datetime-local"
              aria-invalid={!!errors.dateTo}
              {...register('dateTo')}
            />
            <Err text={errors.dateTo?.message} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t('admin.banners.weekdays')}</Label>
          <Controller
            control={control}
            name="scheduleDays"
            render={({ field }) => (
              <div className="flex gap-3 flex-wrap">
                {WEEKDAYS.map((d) => (
                  <label
                    key={d.value}
                    className="flex items-center gap-1.5 cursor-pointer"
                  >
                    <Checkbox
                      checked={field.value.includes(d.value)}
                      onCheckedChange={(on) =>
                        field.onChange(
                          on
                            ? [...field.value, d.value]
                            : field.value.filter((x) => x !== d.value),
                        )
                      }
                    />
                    <span className="text-sm">{t(d.key)}</span>
                  </label>
                ))}
              </div>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="banner-time-from">
              {t('admin.banners.timeFrom')}
            </Label>
            <Input
              id="banner-time-from"
              type="time"
              {...register('scheduleTimeFrom')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="banner-time-to">{t('admin.banners.timeTo')}</Label>
            <Input
              id="banner-time-to"
              type="time"
              aria-invalid={!!errors.scheduleTimeTo}
              {...register('scheduleTimeTo')}
            />
            <Err text={errors.scheduleTimeTo?.message} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
