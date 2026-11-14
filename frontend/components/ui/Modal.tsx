"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** "card" centers; "drawer" docks right (chat, inspectors). */
  variant?: "card" | "drawer" | "palette";
  children: ReactNode;
}

export function Modal({
  open,
  onOpenChange,
  title,
  variant = "card",
  children,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={
            variant === "drawer" ? "modal-overlay drawer-overlay" : "modal-overlay"
          }
        />
        <Dialog.Content
          className={
            variant === "drawer"
              ? "drawer"
              : variant === "palette"
                ? "modal-card palette"
                : "modal-card"
          }
          aria-describedby={undefined}
        >
          {/* Radix requires a Title for screen readers — hide it when the
              variant supplies its own header. */}
          {!title && (
            <Dialog.Title
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                overflow: "hidden",
                clip: "rect(0 0 0 0)",
              }}
            >
              Dialog
            </Dialog.Title>
          )}
          {title && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <Dialog.Title className="micro" style={{ color: "var(--muted)" }}>
                {title}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button aria-label="Close" style={{ color: "var(--dim)" }}>
                  <X size={14} />
                </button>
              </Dialog.Close>
            </div>
          )}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
