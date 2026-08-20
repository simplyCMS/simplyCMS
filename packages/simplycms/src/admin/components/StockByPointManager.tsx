import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabaseClient } from 'simplycms/supabase/SupabaseProvider';
import { useT } from 'simplycms/i18n';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Button } from 'simplycms/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'simplycms/ui/table';
import { toast } from 'sonner';
import { Loader2, Save, Building } from 'lucide-react';
import type { TablesInsert } from 'simplycms/supabase';
import {
  usePickupPointsCount,
  usePickupPoints,
} from '@simplycms/core/hooks/useStock';

interface StockByPointManagerProps {
  productId?: string | null;
  modificationId?: string | null;
  showCard?: boolean;
}

export function StockByPointManager({
  productId,
  modificationId,
  showCard = true,
}: StockByPointManagerProps) {
  const t = useT();
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();
  const [stockData, setStockData] = useState<Record<string, number>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data: pointsCount = 0 } = usePickupPointsCount();
  const { data: pickupPoints = [], isLoading: pointsLoading } =
    usePickupPoints();

  // Fetch existing stock data
  const { data: existingStock, isLoading: stockLoading } = useQuery({
    queryKey: ['stock-by-point', modificationId ?? productId],
    queryFn: async () => {
      let query = supabase.from('stock_by_pickup_point').select('*');

      if (modificationId) {
        query = query.eq('modification_id', modificationId);
      } else if (productId) {
        query = query.eq('product_id', productId);
      } else {
        return [];
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!(productId || modificationId),
  });

  // Ініціалізація даних залишків (adjust state during render)
  const [prevExistingStock, setPrevExistingStock] = useState(existingStock);
  const [prevPickupPoints, setPrevPickupPoints] = useState(pickupPoints);
  if (
    existingStock &&
    pickupPoints.length > 0 &&
    (existingStock !== prevExistingStock || pickupPoints !== prevPickupPoints)
  ) {
    setPrevExistingStock(existingStock);
    setPrevPickupPoints(pickupPoints);
    const newStockData: Record<string, number> = {};
    pickupPoints.forEach((point) => {
      const existing = existingStock.find(
        (s) => s.pickup_point_id === point.id,
      );
      newStockData[point.id] = existing?.quantity ?? 0;
    });
    setStockData(newStockData);
    setHasChanges(false);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const [pointId, quantity] of Object.entries(stockData)) {
        // Find existing record for this point
        const existingRecord = existingStock?.find(
          (s) => s.pickup_point_id === pointId,
        );

        if (existingRecord) {
          // Update existing record
          const { error } = await supabase
            .from('stock_by_pickup_point')
            .update({ quantity, updated_at: new Date().toISOString() })
            .eq('id', existingRecord.id);

          if (error) throw error;
        } else {
          // Insert new record
          const payload: TablesInsert<'stock_by_pickup_point'> = {
            pickup_point_id: pointId,
            quantity,
          };

          if (modificationId) {
            payload.modification_id = modificationId;
          } else if (productId) {
            payload.product_id = productId;
          }

          const { error } = await supabase
            .from('stock_by_pickup_point')
            .insert(payload);

          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['stock-by-point', modificationId ?? productId],
      });
      queryClient.invalidateQueries({
        queryKey: ['stock-info', modificationId ?? productId],
      });
      setHasChanges(false);
      toast.success(t('admin.products.stock.saved'));
    },
    onError: (error: Error) => {
      toast.error(
        t('admin.products.stock.saveFailed', { message: error.message }),
      );
    },
  });

  const handleQuantityChange = (pointId: string, value: number) => {
    setStockData((prev) => ({
      ...prev,
      [pointId]: Math.max(0, value),
    }));
    setHasChanges(true);
  };

  const totalQuantity = Object.values(stockData).reduce((sum, q) => sum + q, 0);

  if (pointsLoading || stockLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Simplified view for single pickup point
  if (pointsCount <= 1) {
    const singlePoint = pickupPoints[0];
    const content = (
      <div className="space-y-2">
        <Label htmlFor="stock_quantity">
          {t('admin.products.stock.quantityAtWarehouse')}
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="stock_quantity"
            type="number"
            min={0}
            value={singlePoint ? (stockData[singlePoint.id] ?? 0) : 0}
            onChange={(e) => {
              if (singlePoint) {
                handleQuantityChange(
                  singlePoint.id,
                  parseInt(e.target.value) || 0,
                );
              }
            }}
            className="w-32"
          />
          <span className="text-muted-foreground">
            {t('admin.products.stock.units')}
          </span>
          {hasChanges && (
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>
    );

    if (!showCard) return content;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('admin.products.stock.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>{content}</CardContent>
      </Card>
    );
  }

  // Full view for multiple pickup points
  const content = (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('admin.products.stock.warehouse')}</TableHead>
            <TableHead>{t('common.city')}</TableHead>
            <TableHead className="w-32 text-right">
              {t('common.quantity')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pickupPoints.map((point) => (
            <TableRow key={point.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{point.name}</span>
                  {point.is_system && (
                    <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                      {t('common.system')}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {point.city}
              </TableCell>
              <TableCell className="text-right">
                <Input
                  type="number"
                  min={0}
                  value={stockData[point.id] ?? 0}
                  onChange={(e) =>
                    handleQuantityChange(
                      point.id,
                      parseInt(e.target.value) || 0,
                    )
                  }
                  className="w-24 ml-auto text-right"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between pt-2 border-t">
        <div className="text-sm text-muted-foreground">
          {t('admin.products.stock.total')} <strong>{totalQuantity}</strong>{' '}
          {t('admin.products.stock.units')}
        </div>
        {hasChanges && (
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            <Save className="h-4 w-4 mr-2" />
            {t('admin.products.stock.save')}
          </Button>
        )}
      </div>
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
