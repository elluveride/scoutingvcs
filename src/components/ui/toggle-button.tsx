import * as React from "react";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";

interface ToggleButtonProps {
  value: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  onLabel?: string;
  offLabel?: string;
  className?: string;
}

export function ToggleButton({
  value,
  onChange,
  label,
  onLabel = "Yes",
  offLabel = "No",
  className,
}: ToggleButtonProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label && (
        <label className="text-sm font-medium text-muted-foreground">
          {label}
        </label>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={cn(
            "flex-1 h-14 rounded-xl font-semibold transition-all duration-150",
            "flex items-center justify-center gap-2",
            "active:scale-95 touch-manipulation",
            value
              ? "bg-primary text-primary-foreground shadow-lg"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          <Check className="w-5 h-5" />
          {onLabel}
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={cn(
            "flex-1 h-14 rounded-xl font-semibold transition-all duration-150",
            "flex items-center justify-center gap-2",
            "active:scale-95 touch-manipulation",
            !value
              ? "bg-destructive text-destructive-foreground shadow-lg"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          <X className="w-5 h-5" />
          {offLabel}
        </button>
      </div>
    </div>
  );
}
