import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-display uppercase tracking-wide transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_0_18px_var(--accent-soft)] hover:brightness-110",
        outline:
          "border border-input bg-black/60 text-foreground hover:border-primary hover:text-primary hover:shadow-[0_0_14px_var(--accent-soft)]",
        ghost: "text-foreground hover:text-primary",
        destructive: "bg-destructive text-white hover:brightness-110",
        warning: "border border-risk bg-black text-risk hover:bg-risk/10",
        icon: "border border-input bg-black/60 text-foreground/80 hover:border-primary hover:text-primary hover:shadow-[0_0_14px_var(--accent-soft)] data-[active=true]:bg-primary data-[active=true]:border-primary data-[active=true]:text-primary-foreground",
      },
      size: {
        default: "h-9 px-4 text-[11px]",
        sm: "h-7 px-3 text-[10px]",
        lg: "h-12 px-6 text-sm",
        icon: "size-9",
        "icon-sm": "size-7",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
