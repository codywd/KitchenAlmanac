import { z } from "zod";

export const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const familyRoleSchema = z.enum(["OWNER", "ADMIN", "MEMBER"]);
export const mealVoteValueSchema = z.enum(["WANT", "OKAY", "NO"]);
export const shoppingItemStatusSchema = z.enum([
  "NEEDED",
  "BOUGHT",
  "ALREADY_HAVE",
]);

export const createWeekSchema = z.object({
  budgetTargetCents: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
  title: z.string().optional(),
  weekStart: dateOnlySchema,
});

export const ingredientSchema = z.object({
  item: z.string().min(1),
  quantity: z.string().optional(),
});

export const validationFlagsSchema = z.object({
  budgetFit: z.boolean().default(false),
  diabetesFriendly: z.boolean().default(false),
  heartHealthy: z.boolean().default(false),
  kidFriendly: z.boolean().default(false),
  noFishSafe: z.boolean().default(false),
  validationNotes: z.string().optional(),
  weeknightTimeSafe: z.boolean().default(false),
});

export const mealUpsertSchema = z.object({
  batchPrepNote: z.string().optional(),
  costEstimateCents: z.number().int().nonnegative().optional(),
  cuisine: z.string().optional(),
  ingredients: z.array(ingredientSchema).default([]),
  kidAdaptations: z.string().optional(),
  methodSteps: z.array(z.string().min(1)).default([]),
  name: z.string().min(1),
  prepTimeActiveMinutes: z.number().int().nonnegative().optional(),
  prepTimeTotalMinutes: z.number().int().nonnegative().optional(),
  servings: z.number().int().positive().default(7),
  validation: validationFlagsSchema.default({
    budgetFit: false,
    diabetesFriendly: false,
    heartHealthy: false,
    kidFriendly: false,
    noFishSafe: false,
    weeknightTimeSafe: false,
  }),
});

export const mealPatchSchema = mealUpsertSchema.partial().extend({
  validation: validationFlagsSchema.partial().optional(),
});

export const feedbackSchema = z.object({
  createRejectedPattern: z.boolean().default(false),
  patternToAvoid: z.string().optional(),
  reason: z.string().optional(),
  status: z.enum(["PLANNED", "LIKED", "WORKED_WITH_TWEAKS", "REJECTED"]),
  tweaks: z.string().optional(),
});

export const rejectedMealCreateSchema = z.object({
  active: z.boolean().default(true),
  mealName: z.string().min(1),
  patternToAvoid: z.string().min(1),
  reason: z.string().min(1),
});

export const rejectedMealPatchSchema = rejectedMealCreateSchema.partial();

export const groceryListSchema = z.object({
  notes: z.string().optional(),
  sections: z
    .array(
      z.object({
        items: z.array(ingredientSchema),
        name: z.string().min(1),
      }),
    )
    .default([]),
});

export const familyMemberCreateSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  name: z.string().trim().optional(),
  password: z.string().min(8),
  role: familyRoleSchema.default("MEMBER"),
});

export const familyMemberRoleUpdateSchema = z.object({
  memberId: z.string().min(1),
  role: familyRoleSchema,
});

export const familyMemberPasswordResetSchema = z.object({
  memberId: z.string().min(1),
  password: z.string().min(8),
});

export const familyMemberRemoveSchema = z.object({
  memberId: z.string().min(1),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export const mealVoteSchema = z.object({
  comment: z.string().trim().optional(),
  mealId: z.string().min(1),
  vote: mealVoteValueSchema,
});

export const shoppingItemStatusUpdateSchema = z.object({
  canonicalName: z.string().trim().optional(),
  itemName: z.string().trim().min(1),
  quantity: z.string().trim().optional().nullable(),
  status: shoppingItemStatusSchema,
  weekId: z.string().min(1),
});

export const pantryStapleCreateSchema = z.object({
  displayName: z.string().trim().min(1),
});

export const pantryStapleDeactivateSchema = z.object({
  stapleId: z.string().min(1),
});
