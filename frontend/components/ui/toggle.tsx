"use client";

import * as TogglePrimitive from "@radix-ui/react-toggle";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

function Toggle({ className, ...props }: ComponentProps<typeof TogglePrimitive.Root>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(
        "inline-flex size-9 items-center justify-center border border-input bg-black text-foreground transition-colors hover:border-primary data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

export { Toggle };
