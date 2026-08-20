import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@simplycms/ui/select';
import { Label } from '@simplycms/ui/label';
import { Package, PackageX, Clock } from 'lucide-react';
import type { StockStatus } from '@simplycms/core/hooks/useStock';
import { useT, type MessageKey } from 'simplycms/i18n';

interface StockStatusSelectProps {
  value: StockStatus;
  onChange: (value: StockStatus) => void;
  label?: string;
  className?: string;
}

// Мапа КЛЮЧІВ: статус наявності — enum БД, підпис резолвиться в рендері.
const statusOptions: {
  value: StockStatus;
  labelKey: MessageKey;
  icon: React.ReactNode;
  color: string;
}[] = [
  {
    value: 'in_stock',
    labelKey: 'admin.products.stock.inStock',
    icon: <Package className="h-4 w-4" />,
    color: 'text-green-600',
  },
  {
    value: 'out_of_stock',
    labelKey: 'admin.products.stock.outOfStock',
    icon: <PackageX className="h-4 w-4" />,
    color: 'text-destructive',
  },
  {
    value: 'on_order',
    labelKey: 'admin.products.stock.onOrder',
    icon: <Clock className="h-4 w-4" />,
    color: 'text-amber-600',
  },
];

export function StockStatusSelect({
  value,
  onChange,
  label,
  className,
}: StockStatusSelectProps) {
  const t = useT();
  // Дефолт підпису переїхав із деструктуризації в тіло: там уже є транслятор,
  // а в списку параметрів його ще немає.
  const fieldLabel = label ?? t('admin.products.stock.statusLabel');
  const selectedOption = statusOptions.find((opt) => opt.value === value);

  return (
    <div className={className}>
      {fieldLabel && <Label className="mb-2 block">{fieldLabel}</Label>}
      <Select value={value} onValueChange={(v) => onChange(v as StockStatus)}>
        <SelectTrigger>
          <SelectValue>
            {selectedOption && (
              <div className="flex items-center gap-2">
                <span className={selectedOption.color}>
                  {selectedOption.icon}
                </span>
                <span>{t(selectedOption.labelKey)}</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex items-center gap-2">
                <span className={option.color}>{option.icon}</span>
                <span>{t(option.labelKey)}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
