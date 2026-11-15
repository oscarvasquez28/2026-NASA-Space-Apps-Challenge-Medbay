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
}

const FALLBACK_API_URL = "http://localhost:8080";

let cachedConfig: Promise<RuntimeConfig> | null = null;

async function resolveConfig(): Promise<RuntimeConfig> {
  const inlinedUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  const inlinedProvider = process.env.NEXT_PUBLIC_DATA_PROVIDER;

  if (inlinedUrl) {
    return {
      apiUrl: inlinedUrl.replace(/\/+$/, ""),
      dataProvider: inlinedProvider === "mock" ? "mock" : "rest",
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
      };
    }
  } catch {
    // Route handler unreachable — fall through to defaults.
  }

  return {
    apiUrl: FALLBACK_API_URL,
    dataProvider: inlinedProvider === "mock" ? "mock" : "rest",
  };
}

export function getRuntimeConfig(): Promise<RuntimeConfig> {
  if (!cachedConfig) cachedConfig = resolveConfig();
  return cachedConfig;
}
