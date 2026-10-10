import { Controller, useWatch, type UseFormReturn } from 'react-hook-form';
import { BANNER_PLACEMENTS, BANNER_ANIMATIONS } from 'simplycms/contracts';
import { BANNER_ANIMATION_MS, BANNER_SLIDE_MS } from 'simplycms/domain';
import { useT } from 'simplycms/i18n';
import type { Section } from 'simplycms/schema/types';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Label } from 'simplycms/ui/label';
import { Slider } from 'simplycms/ui/slider';
import { Switch } from 'simplycms/ui/switch';
import { SortOrderField } from '../catalog-dictionaries/form-fields';
import { SelectField } from '../shipping/methods/SelectField';
import { ANIMATION_KEYS, PLACEMENT_KEYS, opts } from './banner-options';
import type { BannerFormInput, BannerFormValues } from './banner-form-schema';

interface Props {
  readonly form: UseFormReturn<BannerFormInput, unknown, BannerFormValues>;
  readonly sections: readonly Section[];
}

/** Бічна колонка: розміщення (+розділ), анімація, статус і порядок. */
export function BannerSideCards({ form, sections }: Props) {
  const t = useT();
  const { register, control, formState } = form;
  const { errors } = formState;
  const placement = useWatch({ control, name: 'placement' });
  const animation = useWatch({ control, name: 'animationDuration' });
  const slide = useWatch({ control, name: 'slideDuration' });
  const sectionError = errors.sectionId
    ? errors.sectionId.type === 'server'
      ? errors.sectionId.message
      : t('admin.banners.sectionRequired')
    : undefined;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.banners.placement')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SelectField
            control={control}
            name="placement"
            id="banner-placement"
            label={t('admin.banners.placementLabel')}
            options={opts(BANNER_PLACEMENTS, PLACEMENT_KEYS, t)}
          />
          {placement === 'section' && (
            <SelectField
              control={control}
              name="sectionId"
              id="banner-section"
              label={t('admin.banners.placement.section')}
              placeholder={t('admin.banners.pickSection')}
              options={sections.map((s) => ({ value: s.id, text: s.name }))}
              note={sectionError}
              noteIsError
            />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.banners.animation')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SelectField
            control={control}
            name="animationType"
            id="banner-animation"
            label={t('admin.banners.animationType')}
            options={opts(BANNER_ANIMATIONS, ANIMATION_KEYS, t)}
          />
          <Controller
            control={control}
            name="animationDuration"
            render={({ field }) => (
              <div className="space-y-2">
                <Label>
                  {t('admin.banners.animationDuration')} {animation}{' '}
                  {t('admin.banners.ms')}
                </Label>
                <Slider
                  value={[field.value]}
                  onValueChange={([v]) => field.onChange(v)}
                  min={BANNER_ANIMATION_MS.min}
                  max={BANNER_ANIMATION_MS.max}
                  step={50}
                />
              </div>
            )}
          />
          <Controller
            control={control}
            name="slideDuration"
            render={({ field }) => (
              <div className="space-y-2">
                <Label>
                  {t('admin.banners.slideDuration')} {(slide / 1000).toFixed(1)}{' '}
                  {t('admin.banners.sec')}
                </Label>
                <Slider
                  value={[field.value]}
                  onValueChange={([v]) => field.onChange(v)}
                  min={BANNER_SLIDE_MS.min}
                  max={BANNER_SLIDE_MS.max}
                  step={500}
                />
              </div>
            )}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('common.status')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="banner-active">{t('common.activeM')}</Label>
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <Switch
                  id="banner-active"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>
          <SortOrderField
            id="banner-sort"
            label={t('common.sortOrder')}
            registration={register('sortOrder')}
            invalid={!!errors.sortOrder}
          />
        </CardContent>
      </Card>
    </div>
  );
}
