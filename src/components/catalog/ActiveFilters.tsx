import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface ActiveFilter {
  key: string;
  label: string;
  value: string;
  type: "option" | "range" | "price";
  optionId?: string;
}

interface ActiveFiltersProps {
  filters: ActiveFilter[];
  onRemoveFilter: (filter: ActiveFilter) => void;
  onClearAll: () => void;
}

export function ActiveFilters({ filters, onRemoveFilter, onClearAll }: ActiveFiltersProps) {
  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <span className="text-sm text-muted-foreground">Активні фільтри:</span>
      {filters.map((filter, index) => (
        <Badge
          key={`${filter.key}-${filter.optionId || index}`}
          variant="secondary"
          className="gap-1 pr-1"
        >
          <span className="text-xs text-muted-foreground">{filter.label}:</span>
          <span>{filter.value}</span>
          <button
            onClick={() => onRemoveFilter(filter)}
            className="ml-1 hover:bg-muted rounded-full p-0.5"
            aria-label={`Видалити фільтр ${filter.label}: ${filter.value}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Button variant="ghost" size="sm" onClick={onClearAll} className="h-6 text-xs">
        Скинути всі
      </Button>
    </div>
  );
}
