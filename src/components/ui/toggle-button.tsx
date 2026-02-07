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
  /** When true, "on" is shown as bad (red) and "off" as good (green) */
  invertColors?: boolean;
}

export function ToggleButton({
  value,
  onChange,
  label,
  onLabel = "Yes",
  offLabel = "No",
  className,
  invertColors = false,
}: ToggleButtonProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label && (
        <label className="pit-counter-label text-center">
          {label}
        </label>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={cn(
            "pit-button flex-1 flex items-center justify-center gap-2",
            value
              ? invertColors
                ? "bg-destructive text-destructive-foreground border-destructive"
                : "pit-button-active"
              : "pit-button-muted"
          )}
          style={value && invertColors ? { boxShadow: '0 0 15px hsl(0 75% 50% / 0.5), 0 0 30px hsl(0 75% 50% / 0.2)' } : value && !invertColors ? { boxShadow: '0 0 15px hsl(var(--primary) / 0.5), 0 0 30px hsl(var(--primary) / 0.2)' } : undefined}
        >
          {invertColors ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          <span>{onLabel}</span>
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={cn(
            "pit-button flex-1 flex items-center justify-center gap-2",
            !value
              ? invertColors
                ? "pit-button-active"
                : "bg-destructive text-destructive-foreground border-destructive"
              : "pit-button-muted"
          )}
          style={!value && !invertColors ? { boxShadow: '0 0 15px hsl(0 75% 50% / 0.5), 0 0 30px hsl(0 75% 50% / 0.2)' } : !value && invertColors ? { boxShadow: '0 0 15px hsl(var(--primary) / 0.5), 0 0 30px hsl(var(--primary) / 0.2)' } : undefined}
        >
          {invertColors ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          <span>{offLabel}</span>
        </button>
      </div>
    </div>
  );
}
