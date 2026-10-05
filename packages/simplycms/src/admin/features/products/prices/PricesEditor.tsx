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
import { useServerFieldErrors } from '../../../lib/useServerFieldErrors';
import { buildPricesInput, usePrices, type PriceDraft } from './usePrices';
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
  const fieldErrors = useServerFieldErrors();

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
  ) => {
    fieldErrors.clear(`${priceTypeId}.${field}`);
    setDraft((prev) => ({
      ...prev,
      [priceTypeId]: { ...valueFor(priceTypeId), [field]: value },
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    fieldErrors.reset();
    const merged: PriceDraft = {};
    for (const pt of priceTypes) merged[pt.id] = valueFor(pt.id);
    try {
      const failedTypeId = await save(merged);
      setInvalid(failedTypeId);
      if (!failedTypeId) {
        setDraft({});
        toast.success(t('admin.products.prices.saved'));
      }
    } catch (e) {
      // Тема 12: `path` сервера позиційний (`prices.<i>.price`) — індекс у
      // ТОМУ САМОМУ вході, який будує `save` (`buildPricesInput`).
      const built = buildPricesInput(merged);
      const order = 'input' in built ? built.input : [];
      fieldErrors.handle(e, {
        fieldFor: (path) => {
          const entry = path[0] === 'prices' ? order[Number(path[1])] : null;
          const field = path[2];
          return entry && (field === 'price' || field === 'oldPrice')
            ? `${entry.priceTypeId}.${field}`
            : null;
        },
      });
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
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
          >
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
                priceError={fieldErrors.errors[`${pt.id}.price`]}
                oldPriceError={fieldErrors.errors[`${pt.id}.oldPrice`]}
                onChange={(field, value) => setField(pt.id, field, value)}
              />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
