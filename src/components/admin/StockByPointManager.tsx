import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Save, Building } from "lucide-react";
import { usePickupPointsCount, usePickupPoints } from "@/hooks/useStock";

interface StockByPointManagerProps {
  productId?: string | null;
  modificationId?: string | null;
  showCard?: boolean;
}

interface StockRecord {
  pickup_point_id: string;
  quantity: number;
}

export function StockByPointManager({
  productId,
  modificationId,
  showCard = true,
}: StockByPointManagerProps) {
  const queryClient = useQueryClient();
  const [stockData, setStockData] = useState<Record<string, number>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data: pointsCount = 0 } = usePickupPointsCount();
  const { data: pickupPoints = [], isLoading: pointsLoading } = usePickupPoints();

  // Fetch existing stock data
  const { data: existingStock, isLoading: stockLoading } = useQuery({
    queryKey: ["stock-by-point", modificationId ?? productId],
    queryFn: async () => {
      let query = supabase.from("stock_by_pickup_point").select("*");

      if (modificationId) {
        query = query.eq("modification_id", modificationId);
      } else if (productId) {
        query = query.eq("product_id", productId);
      } else {
        return [];
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!(productId || modificationId),
  });

  // Initialize stock data when existing stock loads
  useEffect(() => {
    if (existingStock && pickupPoints.length > 0) {
      const newStockData: Record<string, number> = {};
      pickupPoints.forEach((point) => {
        const existing = existingStock.find(
          (s) => s.pickup_point_id === point.id
        );
        newStockData[point.id] = existing?.quantity ?? 0;
      });
      setStockData(newStockData);
      setHasChanges(false);
    }
  }, [existingStock, pickupPoints]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const [pointId, quantity] of Object.entries(stockData)) {
        // Find existing record for this point
        const existingRecord = existingStock?.find(
          (s) => s.pickup_point_id === pointId
        );

        if (existingRecord) {
          // Update existing record
          const { error } = await supabase
            .from("stock_by_pickup_point")
            .update({ quantity, updated_at: new Date().toISOString() })
            .eq("id", existingRecord.id);

          if (error) throw error;
        } else {
          // Insert new record
          const payload: any = {
            pickup_point_id: pointId,
            quantity,
          };

          if (modificationId) {
            payload.modification_id = modificationId;
          } else if (productId) {
            payload.product_id = productId;
          }

          const { error } = await supabase
            .from("stock_by_pickup_point")
            .insert(payload);

          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["stock-by-point", modificationId ?? productId],
      });
      queryClient.invalidateQueries({
        queryKey: ["stock-info", modificationId ?? productId],
      });
      setHasChanges(false);
      toast.success("Залишки збережено");
    },
    onError: (error: Error) => {
      toast.error(`Помилка збереження: ${error.message}`);
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
        <Label htmlFor="stock_quantity">Кількість на складі</Label>
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
                  parseInt(e.target.value) || 0
                );
              }
            }}
            className="w-32"
          />
          <span className="text-muted-foreground">шт.</span>
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
          <CardTitle className="text-base">Залишки</CardTitle>
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
            <TableHead>Склад</TableHead>
            <TableHead>Місто</TableHead>
            <TableHead className="w-32 text-right">Кількість</TableHead>
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
                      Системний
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
                    handleQuantityChange(point.id, parseInt(e.target.value) || 0)
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
          Загалом: <strong>{totalQuantity}</strong> шт.
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
            Зберегти залишки
          </Button>
        )}
      </div>
    </div>
  );

  if (!showCard) return content;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Залишки по складах</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
