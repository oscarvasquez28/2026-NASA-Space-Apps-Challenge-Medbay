/**
 * Runtime configuration resolution for the browser client.
 *
 * Resolution order:
 *  1. `NEXT_PUBLIC_*` env vars inlined at build time (local dev / static builds).
 *  2. `/api/runtime-config` route handler, which reads server-side env vars
 *     (`PUBLIC_API_URL`, `DATA_PROVIDER`) on every request.
 *     This keeps the Docker image configurable at container start without
 *     rebuilding.
 *  3. Hard fallbacks matching the repository defaults.
 */

export interface RuntimeConfig {
  apiUrl: string;
  dataProvider: "mock" | "rest";
  /** Consecutive check-in days per wheel spin (spec 7; 1 for testing). */
  wheelCadenceDays: number;
}

const FALLBACK_API_URL = "http://localhost:8080";
const FALLBACK_WHEEL_CADENCE = 7;

let cachedConfig: Promise<RuntimeConfig> | null = null;

function cadence(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : FALLBACK_WHEEL_CADENCE;
}

async function resolveConfig(): Promise<RuntimeConfig> {
  const inlinedUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  const inlinedProvider = process.env.NEXT_PUBLIC_DATA_PROVIDER;
  const inlinedCadence = process.env.NEXT_PUBLIC_WHEEL_CADENCE_DAYS;

  if (inlinedUrl) {
    return {
      apiUrl: inlinedUrl.replace(/\/+$/, ""),
      dataProvider: inlinedProvider === "mock" ? "mock" : "rest",
      wheelCadenceDays: cadence(inlinedCadence),
    };
  }

  try {
    const res = await fetch("/api/runtime-config", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as Partial<RuntimeConfig>;
      return {
        apiUrl: (data.apiUrl ?? FALLBACK_API_URL).replace(/\/+$/, ""),
        dataProvider:
          data.dataProvider === "mock" || inlinedProvider === "mock"
            ? "mock"
            : "rest",
        wheelCadenceDays: cadence(data.wheelCadenceDays ?? inlinedCadence),
      };
    }
  } catch {
    // Route handler unreachable — fall through to defaults.
  }

  return {
    apiUrl: FALLBACK_API_URL,
    dataProvider: inlinedProvider === "mock" ? "mock" : "rest",
    wheelCadenceDays: cadence(inlinedCadence),
  };
}

export function getRuntimeConfig(): Promise<RuntimeConfig> {
  if (!cachedConfig) cachedConfig = resolveConfig();
  return cachedConfig;
}
