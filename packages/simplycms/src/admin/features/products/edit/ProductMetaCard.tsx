import { eq, useLiveQuery } from '@tanstack/react-db';
import { productsCollection, useCollection } from 'simplycms/admin-data';
import { useFormatDate, useT } from 'simplycms/i18n';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';

interface Props {
  readonly id: string;
}

/**
 * Інформаційна картка: ID і дати. Дат у `products.get` немає, тож їх дає
 * колекція (лише читання) — коли рядок уже завантажено.
 */
export function ProductMetaCard({ id }: Props) {
  const t = useT();
  const formatDate = useFormatDate();
  const products = useCollection(productsCollection);
  const { data: row } = useLiveQuery({
    query: (q) =>
      q
        .from({ p: products })
        .where(({ p }) => eq(p.id, id))
        .findOne(),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('common.information')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>ID: {id}</p>
        {row && (
          <>
            <p>
              {t('admin.products.createdAt')} {formatDate(row.createdAt)}
            </p>
            <p>
              {t('admin.products.updatedAt')} {formatDate(row.updatedAt)}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
