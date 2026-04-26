import { authenticateRequest } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { json, unauthorized } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return unauthorized();
  }

  const [
    documents,
    familyMembers,
    pantryStaples,
    savedRecipes,
    recentMealVotes,
    rejectedMeals,
  ] = await Promise.all([
    getDb().householdDocument.findMany({
      orderBy: {
        kind: "asc",
      },
      where: {
        familyId: auth.family.id,
      },
    }),
    getDb().familyMember.findMany({
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      where: {
        familyId: auth.family.id,
      },
    }),
    getDb().pantryStaple.findMany({
      orderBy: {
        displayName: "asc",
      },
      select: {
        canonicalName: true,
        displayName: true,
        id: true,
      },
      where: {
        active: true,
        familyId: auth.family.id,
      },
    }),
    getDb().savedRecipe.findMany({
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        costEstimateCents: true,
        cuisine: true,
        id: true,
        name: true,
        prepTimeTotalMinutes: true,
        servings: true,
      },
      take: 50,
      where: {
        active: true,
        familyId: auth.family.id,
      },
    }),
    getDb().mealVote.findMany({
      include: {
        meal: {
          select: {
            name: true,
          },
        },
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 50,
      where: {
        meal: {
          dayPlan: {
            week: {
              familyId: auth.family.id,
            },
          },
        },
      },
    }),
    getDb().rejectedMeal.findMany({
      orderBy: {
        rejectedAt: "desc",
      },
      where: {
        active: true,
        familyId: auth.family.id,
      },
    }),
  ]);

  return json({
    documents,
    family: auth.family,
    familyMembers,
    medicalDisclaimer:
      "Planning metadata only; doctor-provided targets override the app defaults.",
    pantryStaples,
    recentMealVotes,
    rejectedMeals,
    savedRecipes,
  });
}
