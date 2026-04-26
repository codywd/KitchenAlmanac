import { authenticateRequest } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { json, notFound, unauthorized } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ weekId: string }> },
) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return unauthorized();
  }

  const { weekId } = await context.params;
  const week = await getDb().week.findFirst({
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
    where: {
      familyId: auth.family.id,
      id: weekId,
    },
  });

  return week ? json({ week }) : notFound("Week not found.");
}
