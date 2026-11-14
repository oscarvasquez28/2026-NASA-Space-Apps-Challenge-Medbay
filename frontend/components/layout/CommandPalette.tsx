"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useCrew } from "@/hooks/useCrew";
import { useLocationContext } from "@/hooks/useLocationContext";
import { dispatchViewerCommand } from "@/stores/viewer-store";
import { useAppStore } from "@/stores/app-store";
import type { LocationId } from "@/types/health";

interface CommandItem {
  id: string;
  label: string;
  kind: "nav" | "crew" | "viewer" | "mode" | "location";
  run: () => void;
}

const NAV_ITEMS: { href: string; label: string }[] = [
  { href: "/", label: "Go to Lab Home" },
  { href: "/crew", label: "Go to Crew Roster" },
  { href: "/telemetry", label: "Go to Telemetry" },
  { href: "/compare", label: "Go to Compare" },
  { href: "/log", label: "Go to Telemetry Log" },
  { href: "/medic", label: "Go to Medic AI" },
  { href: "/settings", label: "Go to Settings" },
];

const VIEWER_CMDS = [
  { cmd: "explode", label: "Viewer: toggle explode" },
  { cmd: "section", label: "Viewer: toggle section plane" },
  { cmd: "wireframe", label: "Viewer: toggle wireframe" },
  { cmd: "edges", label: "Viewer: toggle edges" },
  { cmd: "measure", label: "Viewer: toggle measure" },
  { cmd: "reset", label: "Viewer: reset camera & modes" },
];

/** ⌘K command palette — navigation, viewer tools, modes, crew, location. */
export function CommandPalette() {
  const router = useRouter();
  const open = useAppStore((s) => s.commandOpen);
  const setOpen = useAppStore((s) => s.setCommandOpen);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const viewMode = useAppStore((s) => s.viewMode);
  const { crew } = useCrew();
  const { locations, setLocation } = useLocationContext();

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (!open) {
          setQuery("");
          setActive(0);
        }
        setOpen(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const items: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = [
      ...NAV_ITEMS.map((n) => ({
        id: `nav-${n.href}`,
        label: n.label,
        kind: "nav" as const,
        run: () => router.push(n.href),
      })),
      ...crew.map((c) => ({
        id: `crew-${c.id}`,
        label: `Monitor ${c.name} (${c.id})`,
        kind: "crew" as const,
        run: () => router.push(`/crew/${c.id}`),
      })),
      ...VIEWER_CMDS.map((v) => ({
        id: `viewer-${v.cmd}`,
        label: v.label,
        kind: "viewer" as const,
        run: () => dispatchViewerCommand(v.cmd),
      })),
      {
        id: "mode-toggle",
        label:
          viewMode === "technical"
            ? "Switch to High-Level view"
            : "Switch to Technical view",
        kind: "mode" as const,
        run: () =>
          setViewMode(viewMode === "technical" ? "high_level" : "technical"),
      },
      ...locations.map((l) => ({
        id: `loc-${l.id}`,
        label: `Set location: ${l.label}`,
        kind: "location" as const,
        run: () => setLocation(l.id as LocationId),
      })),
    ];
    const q = query.trim().toLowerCase();
    return q
      ? list.filter((i) => i.label.toLowerCase().includes(q))
      : list;
  }, [crew, locations, query, router, setLocation, setViewMode, viewMode]);

  const runItem = useCallback(
    (item: CommandItem) => {
      item.run();
      setOpen(false);
    },
    [setOpen],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && items[active]) {
      e.preventDefault();
      runItem(items[active]);
    }
  };

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setQuery("");
          setActive(0);
        }
        setOpen(o);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className="modal-card palette"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Type a command or search…"
              aria-label="Command search"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
              }}
            />
            <span className="kbd">ESC</span>
          </div>
          <div className="palette-list" ref={listRef} role="listbox">
            {items.length === 0 && (
              <div className="palette-item">No commands match.</div>
            )}
            {items.map((item, i) => (
              <button
                key={item.id}
                data-index={i}
                role="option"
                aria-selected={i === active}
                className={`palette-item${i === active ? " active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => runItem(item)}
              >
                {item.label}
                <span className="pi-kind">{item.kind}</span>
              </button>
            ))}
          </div>
          <div
            style={{
              padding: "8px 14px",
              borderTop: "1px solid var(--line)",
            }}
            className="micro-8"
          >
            ↑↓ navigate · ↵ run · esc close
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
