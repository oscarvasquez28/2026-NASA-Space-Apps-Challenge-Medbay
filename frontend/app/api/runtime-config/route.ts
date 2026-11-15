import { NextResponse } from "next/server";

/**
 * Runtime configuration for browser clients.
 *
 * Returns the public backend URL and the data-provider kind from server-side
 * env vars so the Docker image stays configurable at container start
 * (`PUBLIC_API_URL`, `DATA_PROVIDER`) without a rebuild. `NEXT_PUBLIC_*`
 * variables remain available as build-time overrides for local development.
 *
 * Crew membership is NOT configurable — the roster is built from enrolled
 * operators (`/register` + visual-ID check-in), keyed by `astronautId`.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const apiUrl =
    process.env.PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8080";

  const dataProvider =
    process.env.DATA_PROVIDER === "mock" ||
    process.env.NEXT_PUBLIC_DATA_PROVIDER === "mock"
      ? "mock"
      : "rest";

  return NextResponse.json({ apiUrl, dataProvider });
}
