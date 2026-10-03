import { useWatch, type UseFormReturn } from 'react-hook-form';
import { useT } from 'simplycms/i18n';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { RichTextEditor } from '../../../components/RichTextEditor';
import { SlugField, TextField } from '../form-fields';
import type {
  SectionFormInput,
  SectionFormValues,
} from './section-form-schema';

interface Props {
  readonly form: UseFormReturn<SectionFormInput, unknown, SectionFormValues>;
}

/** Основна колонка картки розділу: базова інформація й SEO. */
export function SectionMainCards({ form }: Props) {
  const t = useT();
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = form;
  const description = useWatch({ control, name: 'description' });
  return (
    <div className="lg:col-span-2 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('common.basicInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <TextField
              id="section-name"
              label={t('common.name')}
              registration={register('name')}
              invalid={!!errors.name}
              errorText={t('validation.nameRequired')}
            />
            <SlugField
              id="section-slug"
              label={t('admin.common.slug')}
              registration={register('slug')}
              invalid={!!errors.slug}
              hint={t('admin.sections.slugHint')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('common.description')}</Label>
            <RichTextEditor
              content={description}
              onChange={(content) =>
                setValue('description', content, { shouldDirty: true })
              }
              placeholder={t('admin.sections.descriptionPlaceholder')}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.common.seo')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TextField
            id="section-meta-title"
            label={t('admin.common.metaTitle')}
            placeholder={t('admin.sections.seoTitlePlaceholder')}
            registration={register('metaTitle')}
          />
          <div className="space-y-2">
            <Label htmlFor="section-meta-description">
              {t('admin.common.metaDescription')}
            </Label>
            <Input
              id="section-meta-description"
              placeholder={t('common.seoDescription')}
              {...register('metaDescription')}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
