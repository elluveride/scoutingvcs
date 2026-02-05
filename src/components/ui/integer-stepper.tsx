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
        <label className="pit-counter-label text-center">
          {label}
        </label>
      )}
      <div className="flex flex-col md:flex-row items-center gap-2">
        <button
          type="button"
          onClick={increment}
          disabled={atMax}
          className={cn(
            "stepper-button bg-muted text-foreground w-full md:w-auto min-h-[44px] md:min-w-[48px] md:min-h-[48px] touch-manipulation",
            atMax && "opacity-30 cursor-not-allowed",
            !atMax && "hover:bg-primary hover:text-primary-foreground hover:border-primary active:scale-95"
          )}
        >
          <Plus className="w-5 h-5 mx-auto" />
        </button>
        
        <div className="flex-1 pit-counter min-w-[80px] w-full md:w-auto">
          <span className="pit-counter-value">{value}</span>
        </div>
        
        <button
          type="button"
          onClick={decrement}
          disabled={atMin}
          className={cn(
            "stepper-button bg-muted text-foreground w-full md:w-auto min-h-[44px] md:min-w-[48px] md:min-h-[48px] touch-manipulation",
            atMin && "opacity-30 cursor-not-allowed",
            !atMin && "hover:bg-destructive hover:text-destructive-foreground hover:border-destructive active:scale-95"
          )}
        >
          <Minus className="w-5 h-5 mx-auto" />
        </button>
      </div>
    </div>
  );
}
