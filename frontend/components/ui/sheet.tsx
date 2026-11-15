"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;

function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { side?: "left" | "right" }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[200] bg-black/70 animate-in fade-in-0" />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-y-0 z-[201] flex w-[min(92vw,420px)] flex-col gap-4 border-primary bg-black p-6 text-foreground outline-none animate-in",
          side === "right" ? "right-0 border-l slide-in-from-right" : "left-0 border-r slide-in-from-left",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-3 top-3 text-foreground/70 hover:text-primary" aria-label="Close">
          <X size={16} />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function SheetTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("font-display text-base uppercase", className)} {...props} />;
}

export { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger };
