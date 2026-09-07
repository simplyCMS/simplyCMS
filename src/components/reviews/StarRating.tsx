import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
  readonly?: boolean;
}

const sizeMap = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

export function StarRating({
  value,
  onChange,
  size = "md",
  readonly = false,
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState(0);

  const displayValue = hoverValue || value;
  const iconSize = sizeMap[size];

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = displayValue >= star;
        const halfFilled = !filled && displayValue >= star - 0.5;

        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            className={cn(
              "relative transition-colors",
              readonly ? "cursor-default" : "cursor-pointer hover:scale-110 transition-transform"
            )}
            onClick={() => onChange?.(star)}
            onMouseEnter={() => !readonly && setHoverValue(star)}
            onMouseLeave={() => !readonly && setHoverValue(0)}
          >
            {/* Background star (empty) */}
            <Star className={cn(iconSize, "text-muted-foreground/30")} />
            {/* Filled overlay */}
            {(filled || halfFilled) && (
              <Star
                className={cn(
                  iconSize,
                  "absolute inset-0 text-amber-400 fill-amber-400"
                )}
                style={halfFilled ? { clipPath: "inset(0 50% 0 0)" } : undefined}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
