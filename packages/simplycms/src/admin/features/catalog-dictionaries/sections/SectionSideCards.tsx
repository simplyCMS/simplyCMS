import { Controller, useWatch, type UseFormReturn } from 'react-hook-form';
import { useT } from 'simplycms/i18n';
import { Label } from 'simplycms/ui/label';
import { Switch } from 'simplycms/ui/switch';
import { Separator } from 'simplycms/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { ImageUpload } from '../../../components/ImageUpload';
import { SortOrderField } from '../form-fields';
import type {
  SectionFormInput,
  SectionFormValues,
} from './section-form-schema';

interface Props {
  readonly form: UseFormReturn<SectionFormInput, unknown, SectionFormValues>;
  /** id рядка або згенерований НАПЕРЕД id нового розділу (Е4-10). */
  readonly entityId: string;
}

/** Бічна колонка картки розділу: активність, порядок, зображення. */
export function SectionSideCards({ form, entityId }: Props) {
  const t = useT();
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = form;
  const images = useWatch({ control, name: 'images' });
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.nav.settings')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="section-active">{t('common.activeM')}</Label>
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <Switch
                  id="section-active"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>
          <Separator />
          <SortOrderField
            id="section-sort"
            label={t('common.sortOrder')}
            registration={register('sortOrder')}
            invalid={!!errors.sortOrder}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('common.image')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ImageUpload
            images={images}
            onImagesChange={(next) =>
              setValue('images', next, { shouldDirty: true })
            }
            entityType="section"
            entityId={entityId}
            maxImages={1}
          />
        </CardContent>
      </Card>
    </div>
  );
}
