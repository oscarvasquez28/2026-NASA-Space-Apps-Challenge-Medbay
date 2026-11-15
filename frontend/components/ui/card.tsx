import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/** MEDBAY frame: square, 1px stroke, black fill. `tone` tints the stroke. */
function Card({
  className,
  tone = "default",
  ...props
}: ComponentProps<"div"> & {
  tone?: "default" | "highlight" | "risk" | "critical" | "healthy" | "muted";
}) {
  return (
    <div
      data-slot="card"
      data-tone={tone}
      className={cn(
        "relative border bg-black text-card-foreground",
        tone === "default" && "border-input",
        tone === "highlight" && "border-primary",
        tone === "risk" && "border-risk",
        tone === "critical" && "border-critical",
        tone === "healthy" && "border-healthy",
        tone === "muted" && "border-input",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex items-center gap-3 px-4 pt-4", className)}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("font-display text-sm uppercase leading-tight", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("p-4", className)} {...props} />;
}

/** Tinted section panel behind tiles (e.g. the vitals well). */
function Panel({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="panel"
      className={cn("bg-[var(--panel-tint)] p-4", className)}
      {...props}
    />
  );
}

export { Card, CardContent, CardHeader, CardTitle, Panel };
