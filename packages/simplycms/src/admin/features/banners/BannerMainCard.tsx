import type { UseFormReturn } from 'react-hook-form';
import { BANNER_TEXT_POSITIONS } from 'simplycms/contracts';
import { useT } from 'simplycms/i18n';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';
import { SelectField } from '../shipping/methods/SelectField';
import { BannerImageField } from './BannerImageField';
import { ALIGN_KEYS, opts } from './banner-options';
import type { BannerFormInput, BannerFormValues } from './banner-form-schema';

interface Props {
  readonly form: UseFormReturn<BannerFormInput, unknown, BannerFormValues>;
  readonly entityId: string;
}

/** Картка «Основне»: тексти, три зображення, позиція тексту й колір оверлею. */
export function BannerMainCard({ form, entityId }: Props) {
  const t = useT();
  const { register, control, formState } = form;
  const { errors } = formState;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.banners.main')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="banner-title">{t('admin.banners.titleField')}</Label>
          <Input
            id="banner-title"
            aria-invalid={!!errors.title}
            {...register('title')}
          />
          {errors.title && (
            <p role="alert" className="text-xs text-destructive">
              {t('admin.banners.titleRequired')}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="banner-subtitle">{t('admin.banners.subtitle')}</Label>
          <Input id="banner-subtitle" {...register('subtitle')} />
        </div>
        <BannerImageField
          form={form}
          name="imageUrl"
          label={t('admin.banners.imageField')}
          entityId={entityId}
          error={errors.imageUrl && t('admin.banners.imageRequired')}
        />
        <BannerImageField
          form={form}
          name="desktopImageUrl"
          label={t('admin.banners.imageDesktop')}
          entityId={entityId}
        />
        <BannerImageField
          form={form}
          name="mobileImageUrl"
          label={t('admin.banners.imageMobile')}
          entityId={entityId}
        />
        <div className="grid grid-cols-2 gap-4">
          <SelectField
            control={control}
            name="textPosition"
            id="banner-text-position"
            label={t('admin.banners.textPosition')}
            options={opts(BANNER_TEXT_POSITIONS, ALIGN_KEYS, t)}
          />
          <div className="space-y-2">
            <Label htmlFor="banner-overlay">
              {t('admin.banners.overlayColor')}
            </Label>
            <Input
              id="banner-overlay"
              placeholder="rgba(0,0,0,0.4)"
              aria-invalid={!!errors.overlayColor}
              {...register('overlayColor')}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
