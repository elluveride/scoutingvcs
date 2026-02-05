import * as React from "react";
import { cn } from "@/lib/utils";

interface RippleItem {
  id: number;
  x: number;
  y: number;
  sides: number;
}

interface RippleProps {
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
}

// Generate a random polygon side count (circle = many sides, or 3-7)
function getRandomSides(): number {
  const options = [0, 3, 4, 5, 6, 7]; // 0 = circle
  return options[Math.floor(Math.random() * options.length)];
}

// Generate polygon clip-path for n sides (0 = circle)
function getPolygonPath(sides: number, rotation: number, progress: number): string {
  // Start as rounded rectangle (inset), morph to polygon
  if (progress < 0.2) {
    // Keep as rounded rectangle initially
    const roundness = 20 - (progress * 50); // shrink roundness
    return `inset(0% round ${Math.max(roundness, 0)}%)`;
  }
  
  // Morph progress from 0.2 to 1.0 mapped to 0-1
  const morphProgress = (progress - 0.2) / 0.8;
  
  if (sides === 0) {
    return "circle(50% at 50% 50%)";
  }
  
  const points: string[] = [];
  const angleOffset = rotation * (Math.PI / 180);
  
  for (let i = 0; i < sides; i++) {
    const angle = (2 * Math.PI * i) / sides - Math.PI / 2 + angleOffset;
    const x = 50 + 50 * Math.cos(angle);
    const y = 50 + 50 * Math.sin(angle);
    points.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`);
  }
  
  return `polygon(${points.join(", ")})`;
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
      const sides = getRandomSides();

      const newRipple: RippleItem = {
        id: nextId.current++,
        x,
        y,
        sides,
      };

      setRipples((prev) => [...prev, newRipple]);

      // Remove ripple after animation completes
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
      }, 1000);
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
        <RippleElement key={ripple.id} ripple={ripple} />
      ))}
    </div>
  );
}

interface RippleElementProps {
  ripple: RippleItem;
}

function RippleElement({ ripple }: RippleElementProps) {
  const [rotation, setRotation] = React.useState(0);
  const [progress, setProgress] = React.useState(0);
  const animationRef = React.useRef<number>();

  React.useEffect(() => {
    const startTime = performance.now();
    const duration = 1000; // ms
    const rotationSpeed = 60; // degrees per animation cycle

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const prog = Math.min(elapsed / duration, 1);
      
      // Slow rotation during expansion
      setRotation(prog * rotationSpeed);
      setProgress(prog);
      
      if (prog < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const clipPath = getPolygonPath(ripple.sides, rotation, progress);

  return (
    <span
      className="pointer-events-none absolute animate-ripple-expand"
      style={{
        left: ripple.x,
        top: ripple.y,
        transform: "translate(-50%, -50%)",
        clipPath,
        background: "currentColor",
        opacity: 0.15,
        filter: "blur(2px)",
      }}
    />
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
