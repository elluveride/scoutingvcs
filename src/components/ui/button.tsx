import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Ripple } from "@/components/ui/ripple";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.97] border border-transparent",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 border-primary/30 shadow-[0_0_15px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_20px_hsl(var(--primary)/0.4)]",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 border-destructive/30 shadow-[0_0_15px_hsl(var(--destructive)/0.3)]",
        outline: "border-border bg-background hover:bg-accent hover:text-accent-foreground hover:border-accent/50",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90 border-secondary/30 shadow-[0_0_15px_hsl(var(--secondary)/0.3)] hover:shadow-[0_0_20px_hsl(var(--secondary)/0.4)]",
        ghost: "hover:bg-accent/50 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-12 rounded-xl px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  disableRipple?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, disableRipple = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    
    const button = (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );

    if (disableRipple || asChild) {
      return button;
    }

    return (
      <Ripple className={cn("rounded-2xl", size === "sm" && "rounded-xl")}>
        {button}
      </Ripple>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
