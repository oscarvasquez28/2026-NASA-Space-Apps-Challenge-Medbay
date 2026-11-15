import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/AppShell";

import "./globals.css";

export const metadata: Metadata = {
  title: "ASTROLAB — Astronaut Health Monitoring",
  description:
    "Interactive lab console for astronaut health monitoring and autonomous triage (simulated telemetry).",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
