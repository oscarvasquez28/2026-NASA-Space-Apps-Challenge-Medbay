import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 border px-2 py-0.5 font-display text-[9px] uppercase tracking-wider",
  {
    variants: {
      variant: {
        default: "border-primary text-primary",
        solid: "border-primary bg-primary text-primary-foreground",
        healthy: "border-healthy text-healthy",
        risk: "border-risk text-risk",
        critical: "border-critical text-critical",
        muted: "border-input text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
