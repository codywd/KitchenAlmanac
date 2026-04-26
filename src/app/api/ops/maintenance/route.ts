import { json, unauthorized } from "@/lib/http";
import { runOpsMaintenance } from "@/lib/ops";

export const dynamic = "force-dynamic";

function isAuthorizedCron(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return unauthorized();
  }

  const result = await runOpsMaintenance();

  return json({
    ok: true,
    result,
  });
}
