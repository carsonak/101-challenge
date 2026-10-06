import { parseServerConfig } from "@challenge/contracts";
import { readiness } from "@challenge/core";
import { createDatabase } from "@challenge/db";

export const dynamic = "force-dynamic";
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
