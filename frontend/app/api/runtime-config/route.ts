import { NextResponse } from "next/server";

/**
 * Runtime configuration for browser clients.
 *
 * Returns the public backend URL, the data-provider kind and astronaut
 * identifiers from server-side env vars so the Docker image stays
 * configurable at container start (`PUBLIC_API_URL`, `DATA_PROVIDER`,
 * `ASTRONAUT_IDS`) without a rebuild. `NEXT_PUBLIC_*` variables remain
 * available as build-time overrides for local development.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const apiUrl =
    process.env.PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8080";

  const dataProvider =
    process.env.DATA_PROVIDER === "rest" ||
    process.env.NEXT_PUBLIC_DATA_PROVIDER === "rest"
      ? "rest"
      : "mock";

  const astronautIds = (
    process.env.ASTRONAUT_IDS ??
    process.env.NEXT_PUBLIC_ASTRONAUT_IDS ??
    "AST-01,AST-02,AST-03,AST-04"
  )
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  return NextResponse.json({ apiUrl, dataProvider, astronautIds });
}
