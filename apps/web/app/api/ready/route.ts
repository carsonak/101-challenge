import { parseServerConfig } from "@challenge/contracts";
import { readiness } from "@challenge/core";
import { createDatabase } from "@challenge/db";

/** Next.js route policy evaluating readiness on each request instead of serving a cached result. */
export const dynamic = "force-dynamic";
/**
 * Handle `GET /api/ready` for readiness monitoring before routing traffic to the web service.
 * Returns HTTP 200 when configuration and database connectivity pass, otherwise 503.
 * When a database is configured, opens and closes connections for a read-only check.
 */
export async function GET() {
  const result = await readiness("web", async () => {
    const config = parseServerConfig(process.env);
    if (!config.DATABASE_URL) throw new Error("Database not configured");
    const database = createDatabase(config.DATABASE_URL);
    try {
      await database.probe();
    } finally {
      await database.close();
    }
  });
  return Response.json(result, { status: result.status === "ok" ? 200 : 503 });
}
