import { ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { DOMAIN_ERROR_NAME } from 'simplycms/contracts/domain-errors';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { adminPath } from '../../../lib/adminLinks';
import { ProductCard } from './ProductCard';
import {
  useProductAggregate,
  useProductLanguages,
} from './useProductAggregate';

interface Props {
  readonly productId: string;
}

/**
 * Сторінка існуючого товару: завантажує агрегат (`products.get`) і мови, далі
 * віддає їх `ProductCard`. 🔴 `productId`, що не є uuid (стара закладка), інакше
 * дав би 400 зі схеми команди — перевіряємо ДО запиту.
 */
export function ProductEditPage({ productId }: Props) {
  const t = useT();
  const navigate = useNavigate();
  const isValidId = z.uuid().safeParse(productId).success;
  const agg = useProductAggregate(productId, isValidId);
  const langs = useProductLanguages();
  const goBack = () => navigate({ to: adminPath('products') });
  const back = (
    <Button variant="ghost" size="icon" onClick={goBack}>
      <ArrowLeft className="h-5 w-5" />
    </Button>
  );

  const notFound =
    !isValidId ||
    (agg.error as { name?: string } | null)?.name ===
      DOMAIN_ERROR_NAME.notFound;
  if (notFound)
    return (
      <div className="space-y-4">
        {back}
        <p className="text-muted-foreground">{t('admin.products.notFound')}</p>
      </div>
    );

  if (agg.isError || langs.isError)
    return (
      <div className="space-y-4">
        {back}
        <p className="text-destructive">{t('admin.translations.loadFailed')}</p>
        <Button
          variant="outline"
          onClick={() => {
            void agg.refetch();
            void langs.refetch();
          }}
        >
          {t('admin.translations.retry')}
        </Button>
      </div>
    );

  if (!agg.data || !langs.data)
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );

  const primary = langs.data.find((l) => l.isDefault)?.code;
  const title = (primary && agg.data.texts[primary]?.name) || '';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {back}
        <div>
          <h1 className="text-3xl font-bold">
            {title || t('admin.products.editTitle')}
          </h1>
          <p className="text-muted-foreground">
            {t('admin.products.editSubtitle')}
          </p>
        </div>
      </div>
      <ProductCard
        productId={productId}
        aggregate={agg.data}
        languages={langs.data}
        refetch={async () => (await agg.refetch()).data}
      />
    </div>
  );
}
