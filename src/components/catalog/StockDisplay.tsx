import { Badge } from "@/components/ui/badge";
import { Check, X, Clock, Building } from "lucide-react";
import {
  useStock,
  usePickupPointsCount,
  type StockStatus,
  type StockByPoint,
} from "@/hooks/useStock";

interface StockDisplayProps {
  productId?: string | null;
  modificationId?: string | null;
  showDetails?: boolean;
  className?: string;
}

export function StockDisplay({
  productId,
  modificationId,
  showDetails = true,
  className,
}: StockDisplayProps) {
  const { data: stockInfo, isLoading } = useStock(productId, modificationId);
  const { data: pointsCount = 0 } = usePickupPointsCount();

  if (isLoading) {
    return (
      <div className={`animate-pulse h-5 w-24 bg-muted rounded ${className}`} />
    );
  }

  if (!stockInfo) {
    return null;
  }

  const { totalQuantity, isAvailable, stockStatus, byPoint } = stockInfo;

  // For "on_order" status, show special badge
  if (stockStatus === "on_order") {
    return (
      <div className={className}>
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-amber-500" />
          <span className="text-amber-600 font-medium">Під замовлення</span>
        </div>
        {showDetails && totalQuantity > 0 && pointsCount > 1 && (
          <StockByPointList byPoint={byPoint} />
        )}
      </div>
    );
  }

  // Out of stock
  if (!isAvailable || stockStatus === "out_of_stock") {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <X className="h-5 w-5 text-destructive" />
        <span className="text-destructive font-medium">Немає в наявності</span>
      </div>
    );
  }

  // In stock - simplified view for single point
  if (pointsCount <= 1) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Check className="h-5 w-5 text-green-500" />
        <span className="text-green-600 font-medium">
          В наявності{totalQuantity > 0 ? `: ${totalQuantity} шт` : ""}
        </span>
      </div>
    );
  }

  // In stock - detailed view for multiple points
  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-2">
        <Check className="h-5 w-5 text-green-500" />
        <span className="text-green-600 font-medium">
          В наявності: {totalQuantity} шт
        </span>
      </div>
      {showDetails && byPoint.length > 0 && (
        <StockByPointList byPoint={byPoint} />
      )}
    </div>
  );
}

function StockByPointList({ byPoint }: { byPoint: StockByPoint[] }) {
  // Filter out points with 0 quantity
  const pointsWithStock = byPoint.filter((p) => p.quantity > 0);

  if (pointsWithStock.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 space-y-1 text-sm">
      {pointsWithStock.map((point) => (
        <div
          key={point.point_id}
          className="flex items-center gap-2 text-muted-foreground"
        >
          <Building className="h-3.5 w-3.5" />
          <span>{point.point_name}:</span>
          <span className="font-medium text-foreground">
            {point.quantity} шт
          </span>
        </div>
      ))}
    </div>
  );
}

// Compact badge for use in lists/cards
export function StockBadge({
  stockStatus,
  isAvailable,
}: {
  stockStatus: StockStatus | null;
  isAvailable: boolean;
}) {
  if (stockStatus === "on_order") {
    return (
      <Badge
        variant="outline"
        className="border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/20"
      >
        Під замовлення
      </Badge>
    );
  }

  if (!isAvailable || stockStatus === "out_of_stock") {
    return <Badge variant="secondary">Немає в наявності</Badge>;
  }

  return null; // Don't show badge for in-stock items
}
