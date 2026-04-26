import { z } from "zod";

import { isValidDateOnly } from "./dates";

export const dateOnlySchema = z
  .string()
  .refine(isValidDateOnly, "Date must be a valid YYYY-MM-DD date.");

export const familyRoleSchema = z.enum(["OWNER", "ADMIN", "MEMBER"]);
export const householdDocumentKindSchema = z.enum([
  "HOUSEHOLD_PROFILE",
  "MEDICAL_GUIDELINES",
  "BATCH_PREP_PATTERNS",
]);
export const mealFeedbackStatusSchema = z.enum([
  "PLANNED",
  "LIKED",
  "WORKED_WITH_TWEAKS",
  "REJECTED",
]);
export const mealOutcomeStatusSchema = z.enum([
  "PLANNED",
  "COOKED",
  "SKIPPED",
  "REPLACED",
  "LEFTOVERS",
]);
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

export const validationFlagsPatchSchema = z.object({
  budgetFit: z.boolean().optional(),
  diabetesFriendly: z.boolean().optional(),
  heartHealthy: z.boolean().optional(),
  kidFriendly: z.boolean().optional(),
  noFishSafe: z.boolean().optional(),
  validationNotes: z.string().optional(),
  weeknightTimeSafe: z.boolean().optional(),
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
  validation: validationFlagsPatchSchema.optional(),
});

export const feedbackSchema = z.object({
  createRejectedPattern: z.boolean().default(false),
  patternToAvoid: z.string().optional(),
  reason: z.string().optional(),
  status: mealFeedbackStatusSchema,
  tweaks: z.string().optional(),
});

export const mealOutcomeSchema = z.object({
  actualCostCents: z.number().int().nonnegative().optional().nullable(),
  createRejectedPattern: z.boolean().default(false),
  feedbackReason: z.string().optional(),
  feedbackStatus: mealFeedbackStatusSchema,
  feedbackTweaks: z.string().optional(),
  leftoverNotes: z.string().optional(),
  outcomeNotes: z.string().optional(),
  outcomeStatus: mealOutcomeStatusSchema,
  patternToAvoid: z.string().optional(),
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

export const activeFilterSchema = z.enum(["true", "false", "all"]).default("true");

export const pantryStaplePatchSchema = z.object({
  active: z.boolean(),
});

export const householdDocumentUpsertSchema = z.object({
  content: z.string(),
  title: z.string().trim().min(1).optional(),
});

const savedRecipeSchemaShape = {
  active: z.boolean().default(true),
  actualCostCents: z.number().int().nonnegative().optional().nullable(),
  batchPrepNote: z.string().optional().nullable(),
  costEstimateCents: z.number().int().nonnegative().optional().nullable(),
  cuisine: z.string().optional().nullable(),
  feedbackReason: z.string().optional().nullable(),
  feedbackStatus: mealFeedbackStatusSchema.optional().nullable(),
  feedbackTweaks: z.string().optional().nullable(),
  ingredients: z.array(ingredientSchema).default([]),
  kidAdaptations: z.string().optional().nullable(),
  leftoverNotes: z.string().optional().nullable(),
  methodSteps: z.array(z.string().min(1)).default([]),
  name: z.string().min(1),
  outcomeNotes: z.string().optional().nullable(),
  outcomeStatus: mealOutcomeStatusSchema.optional().nullable(),
  prepTimeActiveMinutes: z.number().int().nonnegative().optional().nullable(),
  prepTimeTotalMinutes: z.number().int().nonnegative().optional().nullable(),
  servings: z.number().int().positive().default(7),
  sourceRecipe: z.unknown().optional().nullable(),
  validation: validationFlagsSchema.default({
    budgetFit: false,
    diabetesFriendly: false,
    heartHealthy: false,
    kidFriendly: false,
    noFishSafe: false,
    weeknightTimeSafe: false,
  }),
};

export const savedRecipeCreateSchema = z.object(savedRecipeSchemaShape);

export const savedRecipePatchSchema = z.object({
  active: z.boolean().optional(),
  actualCostCents: z.number().int().nonnegative().optional().nullable(),
  batchPrepNote: z.string().optional().nullable(),
  costEstimateCents: z.number().int().nonnegative().optional().nullable(),
  cuisine: z.string().optional().nullable(),
  feedbackReason: z.string().optional().nullable(),
  feedbackStatus: mealFeedbackStatusSchema.optional().nullable(),
  feedbackTweaks: z.string().optional().nullable(),
  ingredients: z.array(ingredientSchema).optional(),
  kidAdaptations: z.string().optional().nullable(),
  leftoverNotes: z.string().optional().nullable(),
  methodSteps: z.array(z.string().min(1)).optional(),
  name: z.string().min(1).optional(),
  outcomeNotes: z.string().optional().nullable(),
  outcomeStatus: mealOutcomeStatusSchema.optional().nullable(),
  prepTimeActiveMinutes: z.number().int().nonnegative().optional().nullable(),
  prepTimeTotalMinutes: z.number().int().nonnegative().optional().nullable(),
  servings: z.number().int().positive().optional(),
  sourceRecipe: z.unknown().optional().nullable(),
  validation: validationFlagsPatchSchema.optional(),
});

export const savedRecipeFromMealSchema = z.object({
  mealId: z.string().min(1),
});

export const savedRecipeSwapSchema = z.object({
  recipeId: z.string().min(1),
});
