import { useFieldArray, type UseFormReturn } from 'react-hook-form';
import { BANNER_MAX_BUTTONS } from 'simplycms/domain';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import { SelectField } from '../shipping/methods/SelectField';
import { TARGET_KEYS, VARIANTS, opts } from './banner-options';
import type { BannerFormInput, BannerFormValues } from './banner-form-schema';

interface Props {
  readonly form: UseFormReturn<BannerFormInput, unknown, BannerFormValues>;
}

const NEW_BUTTON = {
  text: '',
  url: '',
  target: '_self',
  variant: 'primary',
} as const;

/** Кнопки банера: не більше `BANNER_MAX_BUTTONS` (те саме число, що на сервері). */
export function BannerButtonsCard({ form }: Props) {
  const t = useT();
  const { register, control, formState } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'buttons',
  });
  const err = formState.errors.buttons;
  const targets = opts(Object.keys(TARGET_KEYS), TARGET_KEYS, t);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t('admin.banners.buttons')}</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={fields.length >= BANNER_MAX_BUTTONS}
            onClick={() => append(NEW_BUTTON)}
          >
            <Plus className="h-4 w-4 mr-1" />
            {t('common.add')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t('admin.banners.buttonsEmpty')}
          </p>
        )}
        {fields.map((f, i) => (
          <div key={f.id} className="border rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {t('admin.banners.button')} {i + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('admin.banners.removeButton')}
                onClick={() => remove(i)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor={`btn-text-${i}`}>{t('common.text')}</Label>
                <Input
                  id={`btn-text-${i}`}
                  {...register(`buttons.${i}.text`)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`btn-url-${i}`}>URL</Label>
                <Input id={`btn-url-${i}`} {...register(`buttons.${i}.url`)} />
              </div>
              <SelectField
                control={control}
                name={`buttons.${i}.variant`}
                id={`btn-variant-${i}`}
                label={t('admin.banners.buttonVariant')}
                options={VARIANTS.map((v) => ({ value: v, text: v }))}
              />
              <SelectField
                control={control}
                name={`buttons.${i}.target`}
                id={`btn-target-${i}`}
                label={t('admin.banners.buttonTarget')}
                options={targets}
              />
            </div>
          </div>
        ))}
        {err && (
          <p role="alert" className="text-xs text-destructive">
            {err.message || t('admin.banners.buttonInvalid')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
