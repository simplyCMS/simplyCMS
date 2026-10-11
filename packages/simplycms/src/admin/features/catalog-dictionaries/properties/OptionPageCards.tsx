import { useWatch, type UseFormReturn } from 'react-hook-form';
import { useT } from 'simplycms/i18n';
import { Input } from 'simplycms/ui/input';
import { Textarea } from 'simplycms/ui/textarea';
import { Label } from 'simplycms/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { ImageUpload } from '../../../components/ImageUpload';
import { RichTextEditor } from '../../../components/RichTextEditor';
import type { OptionFormInput, OptionFormValues } from './option-form-schema';

interface Props {
  readonly form: UseFormReturn<OptionFormInput, unknown, OptionFormValues>;
  /** id рядка або згенерований НАПЕРЕД id нової опції (Е4-10). */
  readonly entityId: string;
}

/** Сторінка опції на вітрині (зображення, опис) і її SEO. */
export function OptionPageCards({ form, entityId }: Props) {
  const t = useT();
  const { register, control, setValue } = form;
  const description = useWatch({ control, name: 'description' });
  const images = useWatch({ control, name: 'images' });
  const metaTitle = useWatch({ control, name: 'metaTitle' });
  const metaDescription = useWatch({ control, name: 'metaDescription' });
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.properties.options.pageSection')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('common.image')}</Label>
            <ImageUpload
              images={images}
              onImagesChange={(next) =>
                setValue('images', next, { shouldDirty: true })
              }
              entityType="property_option"
              entityId={entityId}
              maxImages={1}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('common.description')}</Label>
            <RichTextEditor
              content={description}
              onChange={(content) =>
                setValue('description', content, { shouldDirty: true })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.common.seo')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="option-meta-title">
              {t('admin.common.metaTitle')}
            </Label>
            <Input
              id="option-meta-title"
              placeholder={t('admin.properties.options.seoTitlePlaceholder')}
              {...register('metaTitle')}
            />
            <p className="text-xs text-muted-foreground">
              {metaTitle.length}
              {t('admin.properties.options.titleCounter')}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="option-meta-description">
              {t('admin.common.metaDescription')}
            </Label>
            <Textarea
              id="option-meta-description"
              placeholder={t('common.seoDescription')}
              rows={3}
              {...register('metaDescription')}
            />
            <p className="text-xs text-muted-foreground">
              {metaDescription.length}
              {t('admin.properties.options.descriptionCounter')}
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
