import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Package, PackageX, Clock } from "lucide-react";
import type { StockStatus } from "@/hooks/useStock";

interface StockStatusSelectProps {
  value: StockStatus;
  onChange: (value: StockStatus) => void;
  label?: string;
  className?: string;
}

const statusOptions: { value: StockStatus; label: string; icon: React.ReactNode; color: string }[] = [
  {
    value: "in_stock",
    label: "В наявності",
    icon: <Package className="h-4 w-4" />,
    color: "text-green-600",
  },
  {
    value: "out_of_stock",
    label: "Немає в наявності",
    icon: <PackageX className="h-4 w-4" />,
    color: "text-destructive",
  },
  {
    value: "on_order",
    label: "Під замовлення",
    icon: <Clock className="h-4 w-4" />,
    color: "text-amber-600",
  },
];

export function StockStatusSelect({
  value,
  onChange,
  label = "Статус наявності",
  className,
}: StockStatusSelectProps) {
  const selectedOption = statusOptions.find((opt) => opt.value === value);

  return (
    <div className={className}>
      {label && <Label className="mb-2 block">{label}</Label>}
      <Select value={value} onValueChange={(v) => onChange(v as StockStatus)}>
        <SelectTrigger>
          <SelectValue>
            {selectedOption && (
              <div className="flex items-center gap-2">
                <span className={selectedOption.color}>{selectedOption.icon}</span>
                <span>{selectedOption.label}</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex items-center gap-2">
                <span className={option.color}>{option.icon}</span>
                <span>{option.label}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
