import { authenticateRequest } from "@/lib/api-auth";
import {
  readJsonWithLimit,
  secureMutationRequest,
} from "@/lib/api-route-security";
import { parseDateOnly } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { canManagePlans } from "@/lib/family";
import { badRequest, forbidden, json, unauthorized } from "@/lib/http";
import { rateLimitPolicies } from "@/lib/rate-limit";
import { createWeekSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return unauthorized();
  }

  const weeks = await getDb().week.findMany({
    include: {
      days: {
        include: {
          dinner: {
            include: {
              votes: {
                include: {
                  user: {
                    select: {
                      email: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          date: "asc",
        },
      },
      groceryList: true,
    },
    orderBy: {
      weekStart: "desc",
    },
    where: {
      familyId: auth.family.id,
    },
  });

  return json({ weeks });
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return unauthorized();
  }

  if (!canManagePlans(auth.role)) {
    return forbidden("Only family owners and admins can create weeks.");
  }

  try {
    const securityResponse = await secureMutationRequest({
      auth,
      rateLimit: {
        policy: rateLimitPolicies.planningWrite,
        scope: "planning-write-api",
        subject: `${auth.family.id}:${auth.actorUserId ?? auth.authType}`,
      },
      request,
    });

    if (securityResponse) {
      return securityResponse;
    }

    const payload = createWeekSchema.parse(await readJsonWithLimit(request));
    const weekStart = parseDateOnly(payload.weekStart);
    const week = await getDb().week.upsert({
      create: {
        budgetTargetCents: payload.budgetTargetCents,
        familyId: auth.family.id,
        notes: payload.notes,
        title: payload.title,
        weekStart,
      },
      include: {
        days: {
          include: {
            dinner: {
              include: {
                votes: {
                  include: {
                    user: {
                      select: {
                        email: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: {
            date: "asc",
          },
        },
        groceryList: true,
      },
      update: {
        budgetTargetCents: payload.budgetTargetCents,
        notes: payload.notes,
        title: payload.title,
      },
      where: {
        familyId_weekStart: {
          familyId: auth.family.id,
          weekStart,
        },
      },
    });

    return json({ week }, { status: 201 });
  } catch (error) {
    return badRequest(error);
  }
}
