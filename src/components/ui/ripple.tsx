import * as React from "react";
import { cn } from "@/lib/utils";

interface RippleItem {
  id: number;
  x: number;
  y: number;
}

interface RippleProps {
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
}

export function Ripple({ className, children, disabled = false }: RippleProps) {
  const [ripples, setRipples] = React.useState<RippleItem[]>([]);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const nextId = React.useRef(0);

  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const newRipple: RippleItem = {
        id: nextId.current++,
        x,
        y,
      };

      setRipples((prev) => [...prev, newRipple]);

      // Remove ripple after animation completes
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
      }, 600);
    },
    [disabled]
  );

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden inline-flex items-center justify-center", className)}
      onClick={handleClick}
    >
      {children}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="pointer-events-none absolute rounded-full animate-ripple-expand bg-current opacity-[0.12]"
          style={{
            left: ripple.x,
            top: ripple.y,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}
    </div>
  );
}

// Higher-order component to wrap any element with ripple
export function withRipple<P extends object>(
  WrappedComponent: React.ComponentType<P>
) {
  return React.forwardRef<HTMLElement, P & { rippleDisabled?: boolean }>(
    ({ rippleDisabled, ...props }, ref) => {
      return (
        <Ripple disabled={rippleDisabled}>
          <WrappedComponent {...(props as P)} ref={ref} />
        </Ripple>
      );
    }
  );
}
