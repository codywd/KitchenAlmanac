import { json } from "@/lib/http";
import { getHealthStatus } from "@/lib/ops";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await getHealthStatus();

  return json(health, {
    status: health.database === "ok" ? 200 : 503,
  });
}
