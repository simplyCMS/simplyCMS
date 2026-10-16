import { useFormContext } from 'react-hook-form';
import { useT } from 'simplycms/i18n';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';
import { Textarea } from 'simplycms/ui/textarea';
import { TranslationStatusBadge } from '../../translations/TranslationStatusBadge';
import {
  fieldStatusOf,
  useTranslationContext,
} from '../../translations/translation-context';
import type { ProductFormValues } from './product-form-schema';

/** SEO-картка активної мови: meta title/description зі статусами полів. */
export function ProductSeoFields() {
  const t = useT();
  const { register } = useFormContext<ProductFormValues>();
  const ctx = useTranslationContext();
  const l = ctx.active;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.products.seoTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label
            htmlFor="product-meta-title"
            className="flex items-center gap-2"
          >
            {t('admin.products.metaTitle')}
            <TranslationStatusBadge
              status={fieldStatusOf(ctx, l, 'metaTitle')}
            />
          </Label>
          <Input
            id="product-meta-title"
            {...register(`texts.${l}.metaTitle`)}
            placeholder={t('admin.products.seoTitlePlaceholder')}
          />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="product-meta-description"
            className="flex items-center gap-2"
          >
            {t('admin.products.metaDescription')}
            <TranslationStatusBadge
              status={fieldStatusOf(ctx, l, 'metaDescription')}
            />
          </Label>
          <Textarea
            id="product-meta-description"
            rows={3}
            {...register(`texts.${l}.metaDescription`)}
            placeholder={t('common.seoDescription')}
          />
        </div>
      </CardContent>
    </Card>
  );
}
