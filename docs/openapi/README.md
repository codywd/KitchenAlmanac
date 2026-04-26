# Kitchen Almanac OpenAPI Specs

These specs are for configuring ChatGPT Custom GPT actions against the Kitchen
Almanac API.

## Recommended Custom GPT Spec

Use `meal-planning-custom-gpt.openapi.yaml`.

In the GPT editor:

1. Create a new action.
2. Choose API key authentication.
3. Set the auth type to Bearer.
4. Paste a family API key created from `/api-keys`.
5. Paste or import `meal-planning-custom-gpt.openapi.yaml`.

The app also accepts the same API key through `X-API-Key`, but the Custom GPT
spec is modeled for Bearer auth because the GPT action editor supports that
directly.

## API-Key-Compatible Endpoints

| Method | Path | Operation ID | Notes |
| --- | --- | --- | --- |
| GET | `/api/household-profile` | `getHouseholdProfile` | Household guidance, members, pantry staples, saved recipes, rejected meals, and recent votes. |
| GET | `/api/household-documents` | `listHouseholdDocuments` | Lists editable household guidance documents. |
| PUT | `/api/household-documents/{kind}` | `upsertHouseholdDocument` | Upserts one guidance document by kind. |
| GET | `/api/planning-brief` | `getPlanningBrief` | Outside-planner brief. Supports `weekStart` and `budgetTargetCents`. |
| POST | `/api/import/meal-plan` | `importMealPlan` | Imports the outside-LLM weekly JSON. The GPT spec uses the `{ weekStart, plan }` envelope. |
| GET | `/api/saved-recipes` | `listSavedRecipes` | Lists saved recipes with `active=true`, `active=false`, or `active=all`. |
| POST | `/api/saved-recipes` | `createSavedRecipe` | Creates a saved recipe from JSON recipe fields. |
| POST | `/api/saved-recipes/from-meal` | `saveMealToRecipeLibrary` | Saves or refreshes a recipe from an existing meal. |
| GET | `/api/saved-recipes/{recipeId}` | `getSavedRecipe` | Reads full saved recipe details. |
| PATCH | `/api/saved-recipes/{recipeId}` | `updateSavedRecipe` | Patches recipe fields or archives/restores with `active`. |
| GET | `/api/pantry-staples` | `listPantryStaples` | Lists pantry staples with `active=true`, `active=false`, or `active=all`. |
| POST | `/api/pantry-staples` | `upsertPantryStaple` | Adds or reactivates a pantry staple. |
| PATCH | `/api/pantry-staples/{stapleId}` | `updatePantryStaple` | Activates or deactivates a pantry staple. |
| GET | `/api/weeks` | `listWeeks` | Lists family weeks newest first. |
| POST | `/api/weeks` | `createWeek` | Upserts a week by family and week start. |
| GET | `/api/weeks/{weekId}` | `getWeek` | Reads one family week. |
| POST | `/api/weeks/{weekId}/days/{date}/meals` | `upsertDinnerForDate` | Creates or replaces one dinner. |
| POST | `/api/weeks/{weekId}/days/{date}/meals/from-saved-recipe` | `replaceDinnerFromSavedRecipe` | Replaces one dinner from a saved recipe. |
| POST | `/api/weeks/{weekId}/grocery-list` | `upsertGroceryList` | Creates or replaces one grocery list. |
| POST | `/api/weeks/{weekId}/grocery-list/refresh` | `refreshGroceryList` | Rebuilds the stored grocery list from current dinners. |
| GET | `/api/weeks/{weekId}/grocery-reconciliation` | `getGroceryReconciliation` | Compares derived grocery items to the stored list. |
| POST | `/api/weeks/{weekId}/shopping-items` | `updateShoppingItemStatus` | Updates shopping item status as the session user or API-key creator. |
| PATCH | `/api/meals/{mealId}` | `updateMeal` | Patches dinner fields. |
| POST | `/api/meals/{mealId}/feedback` | `recordMealFeedback` | Records feedback and can create an avoid pattern. |
| POST | `/api/meals/{mealId}/outcome` | `saveMealOutcome` | Saves closeout outcome, actual cost, leftovers, and feedback. |
| POST | `/api/meals/{mealId}/vote` | `upsertMealVote` | Upserts the session user or API-key creator's vote. |
| GET | `/api/rejected-meals` | `listRejectedMeals` | Lists rejected meals and avoid patterns. |
| POST | `/api/rejected-meals` | `createRejectedMeal` | Creates an avoid pattern. |
| PATCH | `/api/rejected-meals/{id}` | `updateRejectedMeal` | Updates an avoid pattern. |

## Deprecated Session-Only Reference

`meal-planning-session-only.openapi.yaml` is kept only as a historical reference.
`POST /api/weeks/{weekId}/shopping-items` now accepts the same Bearer API key as
the main Custom GPT spec and attributes the update to the API-key creator.

## Server Actions Not Exposed as REST

The app also has Next.js server actions under `src/app/*actions.ts` for login,
account password changes, family management, API key creation/revocation, and UI
form imports. Those are not stable public REST endpoints and are intentionally
not included in the Custom GPT action spec.

## UI Routes

The user-facing page routes include `/`, `/login`, `/calendar`, `/planner`,
`/import`, `/weeks/{weekId}`, `/weeks/{weekId}/review`,
`/weeks/{weekId}/shopping`, `/weeks/{weekId}/closeout`, `/cook/{mealId}`,
`/ingredients`, `/meal-memory`, `/recipes`, `/rejected-meals`, `/household`,
`/family`, `/account`, `/api-keys`, and `/setup`.
