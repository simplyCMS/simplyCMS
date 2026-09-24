import { useFormContext } from 'react-hook-form';
import { useT } from 'simplycms/i18n';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';
import { Textarea } from 'simplycms/ui/textarea';
import type { ProductFormValues } from './product-form-schema';

/** SEO-картка (третя картка легасі `ProductEdit.tsx`) — meta title/description. */
export function ProductSeoFields() {
  const t = useT();
  const { register } = useFormContext<ProductFormValues>();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.products.seoTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="product-meta-title">
            {t('admin.products.metaTitle')}
          </Label>
          <Input
            id="product-meta-title"
            {...register('metaTitle')}
            placeholder={t('admin.products.seoTitlePlaceholder')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="product-meta-description">
            {t('admin.products.metaDescription')}
          </Label>
          <Textarea
            id="product-meta-description"
            rows={3}
            {...register('metaDescription')}
            placeholder={t('common.seoDescription')}
          />
        </div>
      </CardContent>
    </Card>
  );
}
