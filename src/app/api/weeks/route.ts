import { authenticateRequest } from "@/lib/api-auth";
import { parseDateOnly } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { canManagePlans } from "@/lib/family";
import { badRequest, forbidden, json, unauthorized } from "@/lib/http";
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
    const payload = createWeekSchema.parse(await request.json());
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
