import { useState } from 'react';
import { toast } from 'sonner';
import { useT } from 'simplycms/i18n';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Button } from 'simplycms/ui/button';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from 'simplycms/ui/table';
import { Loader2, Save } from 'lucide-react';
import { adminErrorKey } from '../../../lib/admin-error';
import { usePrices, type PriceDraft } from './usePrices';
import { PriceTypeRow } from './PriceTypeRow';

interface Props {
  readonly productId: string;
  readonly modificationId: string | null;
}

const EMPTY_ENTRY = { price: '', oldPrice: '' };

/**
 * Редактор цін за видами (Task 8, Step 1) — розмітка легасі
 * `ProductPricesEditor.tsx`, шар даних — `usePrices`. Кнопка «Зберегти
 * ціни» — атомарний `saveProductPrices` (Е3-10), а не автозбереження.
 */
export function PricesEditor({ productId, modificationId }: Props) {
  const t = useT();
  const { priceTypes, rows, save } = usePrices(productId, modificationId);
  const [draft, setDraft] = useState<PriceDraft>({});
  const [invalid, setInvalid] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const valueFor = (priceTypeId: string) => {
    if (draft[priceTypeId]) return draft[priceTypeId];
    const row = rows.find((r) => r.priceTypeId === priceTypeId);
    return row
      ? { price: row.price, oldPrice: row.oldPrice ?? '' }
      : EMPTY_ENTRY;
  };

  const setField = (
    priceTypeId: string,
    field: 'price' | 'oldPrice',
    value: string,
  ) =>
    setDraft((prev) => ({
      ...prev,
      [priceTypeId]: { ...valueFor(priceTypeId), [field]: value },
    }));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const merged: PriceDraft = {};
      for (const pt of priceTypes) merged[pt.id] = valueFor(pt.id);
      const failedTypeId = await save(merged);
      setInvalid(failedTypeId);
      if (!failedTypeId) {
        setDraft({});
        toast.success(t('admin.products.prices.saved'));
      }
    } catch (e) {
      const key = adminErrorKey(e);
      toast.error(
        key ? t(key) : `${t('common.error')} ${(e as Error).message}`,
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {t('admin.products.mods.prices')}
          </CardTitle>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            {t('admin.products.prices.save')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.users.priceType')}</TableHead>
              <TableHead>{t('common.price')}</TableHead>
              <TableHead>{t('admin.products.prices.oldPrice')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {priceTypes.map((pt) => (
              <PriceTypeRow
                key={pt.id}
                priceTypeId={pt.id}
                name={pt.name}
                isDefault={pt.isDefault}
                value={valueFor(pt.id)}
                hasError={invalid === pt.id}
                onChange={(field, value) => setField(pt.id, field, value)}
              />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
