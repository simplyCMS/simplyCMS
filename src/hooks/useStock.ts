import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StockStatus = 'in_stock' | 'out_of_stock' | 'on_order';

export interface StockByPoint {
  point_id: string;
  point_name: string;
  quantity: number;
}

export interface StockInfo {
  totalQuantity: number;
  isAvailable: boolean;
  stockStatus: StockStatus | null;
  byPoint: StockByPoint[];
}

export function useStock(
  productId?: string | null,
  modificationId?: string | null
) {
  return useQuery({
    queryKey: ["stock-info", modificationId ?? productId],
    queryFn: async (): Promise<StockInfo> => {
      const { data, error } = await supabase.rpc("get_stock_info", {
        p_product_id: modificationId ? null : productId,
        p_modification_id: modificationId ?? null,
      });

      if (error) throw error;

      // RPC returns an array with one row
      const row = data?.[0];
      
      if (!row) {
        return {
          totalQuantity: 0,
          isAvailable: false,
          stockStatus: null,
          byPoint: [],
        };
      }

      const byPoint: StockByPoint[] = Array.isArray(row.by_point)
        ? row.by_point.map((p: any) => ({
            point_id: p.point_id,
            point_name: p.point_name,
            quantity: p.quantity,
          }))
        : [];

      return {
        totalQuantity: row.total_quantity ?? 0,
        isAvailable: row.is_available ?? false,
        stockStatus: row.stock_status as StockStatus | null,
        byPoint,
      };
    },
    enabled: !!(productId || modificationId),
    staleTime: 30000, // 30 seconds
  });
}

export function usePickupPointsCount() {
  return useQuery({
    queryKey: ["pickup-points-count"],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc("get_active_pickup_points_count");
      if (error) throw error;
      return data ?? 0;
    },
    staleTime: 60000, // 1 minute
  });
}

export function usePickupPoints() {
  return useQuery({
    queryKey: ["active-pickup-points"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pickup_points")
        .select("id, name, city, address, is_system")
        .eq("is_active", true)
        .order("is_system", { ascending: false })
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    staleTime: 60000,
  });
}

// Helper to check availability based on stock status
export function isProductAvailable(
  stockStatus: StockStatus | null,
  totalQuantity: number
): boolean {
  if (stockStatus === "on_order") return true;
  if (stockStatus === "in_stock") return totalQuantity > 0;
  return false;
}

// Status display helpers
export function getStockStatusLabel(status: StockStatus | null): string {
  switch (status) {
    case "in_stock":
      return "В наявності";
    case "out_of_stock":
      return "Немає в наявності";
    case "on_order":
      return "Під замовлення";
    default:
      return "Невідомо";
  }
}

export function getStockStatusColor(status: StockStatus | null): string {
  switch (status) {
    case "in_stock":
      return "text-green-600";
    case "out_of_stock":
      return "text-destructive";
    case "on_order":
      return "text-amber-600";
    default:
      return "text-muted-foreground";
  }
}
