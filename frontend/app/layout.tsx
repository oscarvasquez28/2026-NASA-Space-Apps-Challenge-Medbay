import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/unbounded/400.css";
import "@fontsource/unbounded/500.css";
import "@fontsource/unbounded/700.css";
import "@fontsource/unbounded/800.css";
import "@fontsource/ibm-plex-mono/500.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/AppShell";

import "./globals.css";

export const metadata: Metadata = {
  title: "MEDBAY — Astronaut Health Monitoring",
  description:
    "Interactive lab console for astronaut health monitoring and autonomous triage (simulated telemetry).",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-location="station" data-health="healthy" suppressHydrationWarning>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
