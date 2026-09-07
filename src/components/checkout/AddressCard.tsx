import { cn } from "@/lib/utils";
import { Check, MapPin } from "lucide-react";

interface AddressCardProps {
  id: string;
  name: string;
  city: string;
  address: string;
  isSelected: boolean;
  isDefault?: boolean;
  onClick: () => void;
}

export function AddressCard({
  name,
  city,
  address,
  isSelected,
  isDefault,
  onClick,
}: AddressCardProps) {
  // Truncate address for display
  const shortAddress = address.length > 25
    ? `${address.slice(0, 25)}...`
    : address;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-start p-3 rounded-lg border-2 text-left transition-all w-full",
        "hover:border-primary/50 hover:bg-accent/50",
        isSelected
          ? "border-primary bg-primary/5"
          : "border-muted bg-card"
      )}
    >
      {isSelected && (
        <div className="absolute top-2 right-2">
          <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
            <Check className="h-3 w-3 text-primary-foreground" />
          </div>
        </div>
      )}
      
      <div className="flex items-center gap-2 mb-1">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">{name}</span>
        {isDefault && (
          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
            За замовч.
          </span>
        )}
      </div>
      
      <p className="text-xs text-muted-foreground">м. {city}</p>
      <p className="text-xs text-muted-foreground truncate max-w-full">{shortAddress}</p>
    </button>
  );
}
