import { useT } from 'simplycms/i18n';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';

interface Props {
  readonly id: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Інформаційна картка (нижня картка сайдбару легасі `ProductEdit.tsx`) —
 * ID і дати, лише для ІСНУЮЧОГО товару. Винесено з `ProductSidebar.tsx`
 * окремим файлом — канон 150 рядків на новий файл.
 */
export function ProductMetaCard({ id, createdAt, updatedAt }: Props) {
  const t = useT();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('common.information')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>ID: {id}</p>
        <p>
          {t('admin.products.createdAt')}{' '}
          {createdAt.toLocaleDateString('uk-UA')}
        </p>
        <p>
          {t('admin.products.updatedAt')}{' '}
          {updatedAt.toLocaleDateString('uk-UA')}
        </p>
      </CardContent>
    </Card>
  );
}
