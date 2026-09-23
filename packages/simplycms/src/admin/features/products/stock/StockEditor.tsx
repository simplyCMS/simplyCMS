import { useState } from 'react';
import { toast } from 'sonner';
import { useT } from 'simplycms/i18n';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Button } from 'simplycms/ui/button';
import { Loader2, Save } from 'lucide-react';
import {
  usePickupPoints,
  usePickupPointsCount,
} from 'simplycms/core/hooks/useStock';
import { useStock } from './useStock';
import { StockPointsTable } from './StockPointsTable';

interface Props {
  readonly productId: string;
  readonly modificationId: string | null;
  readonly showCard?: boolean;
}

/**
 * Ручний облік залишків (Task 8, Step 2) — розмітка легасі
 * `StockByPointManager.tsx`: одна точка видачі → один інпут, кілька — таблиця.
 * Шар даних — `useStock` (`saveStock`, Е3-3), не автозбереження.
 */
export function StockEditor({
  productId,
  modificationId,
  showCard = true,
}: Props) {
  const t = useT();
  const { rows, save } = useStock(productId, modificationId);
  const { data: pointsCount = 0 } = usePickupPointsCount();
  const { data: pickupPoints = [] } = usePickupPoints();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const valueFor = (pointId: string) =>
    draft[pointId] ??
    String(rows.find((r) => r.pickupPointId === pointId)?.quantity ?? 0);

  const setQuantity = (pointId: string, value: string) =>
    setDraft((prev) => ({ ...prev, [pointId]: value }));

  const hasChanges = Object.keys(draft).length > 0;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const quantities: Record<string, string> = {};
      for (const p of pickupPoints) quantities[p.id] = valueFor(p.id);
      const ok = await save(quantities);
      if (ok) {
        setDraft({});
        toast.success(t('admin.products.stock.saved'));
      } else {
        toast.error(
          t('admin.products.stock.saveFailed', {
            message: t('admin.products.prices.invalid'),
          }),
        );
      }
    } catch (e) {
      toast.error(
        t('admin.products.stock.saveFailed', { message: (e as Error).message }),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const saveButton = hasChanges && (
    <Button size="sm" onClick={handleSave} disabled={isSaving}>
      {isSaving ? (
        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
      ) : (
        <Save className="h-4 w-4 mr-1" />
      )}
      {t('admin.products.stock.save')}
    </Button>
  );

  const content =
    pointsCount <= 1 && pickupPoints[0] ? (
      <div className="space-y-2">
        <Label htmlFor="stock-quantity">
          {t('admin.products.stock.quantityAtWarehouse')}
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="stock-quantity"
            type="number"
            min={0}
            value={valueFor(pickupPoints[0].id)}
            onChange={(e) => setQuantity(pickupPoints[0].id, e.target.value)}
            className="w-32"
          />
          <span className="text-muted-foreground">
            {t('admin.products.stock.units')}
          </span>
          {saveButton}
        </div>
      </div>
    ) : (
      <div className="space-y-4">
        <StockPointsTable
          points={pickupPoints}
          valueFor={valueFor}
          onChange={setQuantity}
        />
        <div className="flex justify-end">{saveButton}</div>
      </div>
    );

  if (!showCard) return content;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t('admin.products.mods.stock')}
        </CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
