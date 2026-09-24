import { Input } from 'simplycms/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'simplycms/ui/table';
import { Building } from 'lucide-react';
import { useT } from 'simplycms/i18n';

/** Мінімальна форма точки видачі, яку потребує таблиця (легасі: snake_case). */
interface PickupPointLike {
  readonly id: string;
  readonly name: string;
  readonly city: string;
  readonly is_system: boolean;
}

interface Props {
  readonly points: readonly PickupPointLike[];
  readonly valueFor: (pointId: string) => string;
  readonly onChange: (pointId: string, value: string) => void;
}

/** Таблиця залишків по точках (Task 8, Step 2) — розмітка легасі `StockByPointManager.tsx`. */
export function StockPointsTable({ points, valueFor, onChange }: Props) {
  const t = useT();
  return (
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
        {points.map((point) => (
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
                id={`stock-quantity-${point.id}`}
                type="number"
                min={0}
                value={valueFor(point.id)}
                onChange={(e) => onChange(point.id, e.target.value)}
                className="w-24 ml-auto text-right"
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
