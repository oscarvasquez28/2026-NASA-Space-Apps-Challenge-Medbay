/**
 * Provider factory + cached accessor.
 *
 * Selection order: NEXT_PUBLIC_DATA_PROVIDER (build-time) →
 * /api/runtime-config `dataProvider` (runtime, Docker) → "mock".
 */

import { getRuntimeConfig } from "@/lib/config";
import type { HealthDataProvider } from "./health-provider";
import { MockHealthDataProvider } from "./mock-provider";
import { RestHealthDataProvider } from "./rest-provider";

export type ProviderKind = "mock" | "rest";

let cached: Promise<HealthDataProvider> | null = null;

function make(kind: ProviderKind): HealthDataProvider {
  return kind === "rest"
    ? new RestHealthDataProvider()
    : new MockHealthDataProvider();
}

async function resolve(): Promise<HealthDataProvider> {
  const inlined = process.env.NEXT_PUBLIC_DATA_PROVIDER?.trim();
  if (inlined === "rest" || inlined === "mock") return make(inlined);
  try {
    const cfg = await getRuntimeConfig();
    if (cfg.dataProvider === "rest") return make("rest");
  } catch {
    // fall through
  }
  return make("mock");
}

export function getProvider(): Promise<HealthDataProvider> {
  if (!cached) cached = resolve();
  return cached;
}
