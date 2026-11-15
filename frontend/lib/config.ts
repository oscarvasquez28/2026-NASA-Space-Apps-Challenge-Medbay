/**
 * Runtime configuration resolution for the browser client.
 *
 * Resolution order:
 *  1. `NEXT_PUBLIC_*` env vars inlined at build time (local dev / static builds).
 *  2. `/api/runtime-config` route handler, which reads server-side env vars
 *     (`PUBLIC_API_URL`, `DATA_PROVIDER`, `ASTRONAUT_IDS`) on every request.
 *     This keeps the Docker image configurable at container start without
 *     rebuilding.
 *  3. Hard fallbacks matching the repository defaults.
 */

export interface RuntimeConfig {
  apiUrl: string;
  astronautIds: string[];
  dataProvider: "mock" | "rest";
}

const FALLBACK_API_URL = "http://localhost:8080";
const FALLBACK_ASTRONAUT_IDS = ["AST-01", "AST-02", "AST-03", "AST-04"];

let cachedConfig: Promise<RuntimeConfig> | null = null;

function parseIds(raw: string | undefined, fallback: string[]): string[] {
  const ids = (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.length > 0 ? ids : fallback;
}

async function resolveConfig(): Promise<RuntimeConfig> {
  const inlinedUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  const inlinedIds = process.env.NEXT_PUBLIC_ASTRONAUT_IDS;
  const inlinedProvider = process.env.NEXT_PUBLIC_DATA_PROVIDER;

  if (inlinedUrl) {
    return {
      apiUrl: inlinedUrl.replace(/\/+$/, ""),
      astronautIds: parseIds(inlinedIds, FALLBACK_ASTRONAUT_IDS),
      dataProvider: inlinedProvider === "mock" ? "mock" : "rest",
    };
  }

  try {
    const res = await fetch("/api/runtime-config", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as Partial<RuntimeConfig>;
      return {
        apiUrl: (data.apiUrl ?? FALLBACK_API_URL).replace(/\/+$/, ""),
        astronautIds:
          Array.isArray(data.astronautIds) && data.astronautIds.length > 0
            ? data.astronautIds
            : parseIds(inlinedIds, FALLBACK_ASTRONAUT_IDS),
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
    astronautIds: parseIds(inlinedIds, FALLBACK_ASTRONAUT_IDS),
    dataProvider: inlinedProvider === "mock" ? "mock" : "rest",
  };
}

export function getRuntimeConfig(): Promise<RuntimeConfig> {
  if (!cachedConfig) cachedConfig = resolveConfig();
  return cachedConfig;
}
