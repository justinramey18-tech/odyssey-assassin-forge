import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const glassVariants = cva(
  "border border-glass transition-all duration-200 ease-out",
  {
    variants: {
      variant: {
        default: "bg-glass-subtle backdrop-blur-lg shadow-glass-glow",
        interactive: 
          "bg-glass backdrop-blur-xl shadow-glass-glow hover:bg-glass-strong hover:backdrop-blur-2xl hover:scale-[1.02] hover:border-white/20 active:scale-[0.98]",
        header: "bg-glass backdrop-blur-xl shadow-glass-glow",
        subtle: "bg-glass-subtle/80 backdrop-blur-sm shadow-glass-glow",
      },
      rounded: {
        none: "rounded-none",
        sm: "rounded-sm",
        md: "rounded-md",
        lg: "rounded-lg",
        xl: "rounded-xl",
        full: "rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      rounded: "lg",
    },
  }
);

export interface GlassProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof glassVariants> {
  asChild?: boolean;
  as?: React.ElementType;
}

const Glass = React.forwardRef<HTMLElement, GlassProps>(
  ({ className, variant, rounded, asChild = false, as: Component = "div", ...props }, ref) => {
    if (asChild) {
      return (
        <Slot
          className={cn(glassVariants({ variant, rounded, className }))}
          ref={ref as React.Ref<HTMLElement>}
          {...props}
        />
      );
    }

    return (
      <Component
        className={cn(glassVariants({ variant, rounded, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

Glass.displayName = "Glass";

export { Glass, glassVariants };
