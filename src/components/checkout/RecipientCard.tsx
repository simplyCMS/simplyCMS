import { cn } from "@/lib/utils";
import { Check, User } from "lucide-react";

interface RecipientCardProps {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  isSelected: boolean;
  isDefault?: boolean;
  onClick: () => void;
}

export function RecipientCard({
  firstName,
  lastName,
  phone,
  city,
  isSelected,
  isDefault,
  onClick,
}: RecipientCardProps) {
  // Mask phone number for display
  const maskedPhone = phone.length > 6
    ? `${phone.slice(0, 4)}...${phone.slice(-3)}`
    : phone;

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
        <User className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm truncate max-w-[120px]">
          {firstName} {lastName}
        </span>
      </div>
      
      <p className="text-xs text-muted-foreground">{maskedPhone}</p>
      <p className="text-xs text-muted-foreground">м. {city}</p>
      
      {isDefault && (
        <span className="mt-1.5 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
          За замовч.
        </span>
      )}
    </button>
  );
}
