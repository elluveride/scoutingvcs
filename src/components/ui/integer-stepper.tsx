import * as React from "react";
import { cn } from "@/lib/utils";
import { Minus, Plus } from "lucide-react";

interface IntegerStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  className?: string;
}

export function IntegerStepper({
  value,
  onChange,
  min = 0,
  max = 999,
  label,
  className,
}: IntegerStepperProps) {
  const decrement = () => {
    if (value > min) onChange(value - 1);
  };

  const increment = () => {
    if (value < max) onChange(value + 1);
  };

  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label && (
        <label className="text-sm font-medium text-muted-foreground">
          {label}
        </label>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={decrement}
          disabled={atMin}
          className={cn(
            "stepper-button bg-muted text-foreground",
            atMin && "opacity-30 cursor-not-allowed",
            !atMin && "hover:bg-destructive hover:text-destructive-foreground"
          )}
        >
          <Minus className="w-6 h-6 mx-auto" />
        </button>
        
        <div className="flex-1 text-center">
          <span className="stat-value text-foreground">{value}</span>
        </div>
        
        <button
          type="button"
          onClick={increment}
          disabled={atMax}
          className={cn(
            "stepper-button bg-muted text-foreground",
            atMax && "opacity-30 cursor-not-allowed",
            !atMax && "hover:bg-primary hover:text-primary-foreground"
          )}
        >
          <Plus className="w-6 h-6 mx-auto" />
        </button>
      </div>
      {max < 999 && (
        <span className="text-xs text-muted-foreground text-center">
          Max: {max}
        </span>
      )}
    </div>
  );
}
