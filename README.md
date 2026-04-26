# KitchenAlmanac

Next.js + Postgres app for storing shared household dinner plans, rejected meals, grocery lists, shopping state, post-dinner outcomes, family votes, and the guidance used by an outside LLM.

The app does not generate meals itself. External callers authenticate with family-scoped API keys and write structured meal-plan data through REST endpoints. Human users sign in with email/password and land on `/calendar`.

## Local Setup

1. Copy `.env.example` to `.env`. Next.js will also read this file locally.
2. Start Postgres:

```bash
docker compose up -d
```

3. Create tables and import the KitchenAlmanac guidance references:

```bash
npm run db:migrate
npm run db:seed
```

4. Start the app:

```bash
npm run dev
```

Default seeded login:

- Email: `cody@example.local`
- Password: `change-me-kitchenalmanac`

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` before seeding to override this.

## Production Setup

Production deployment applies migrations through Vercel's build command:

```bash
prisma migrate deploy && next build
```

Do not run `npm run db:seed` in production unless you are intentionally creating
the first owner and guidance documents. The seed script refuses production
defaults unless all of these are set:

- `ALLOW_PRODUCTION_SEED=true`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `KITCHEN_ALMANAC_SKILL_DIR`

After the first owner signs in, open `/setup` to check launch readiness: family
owner, guidance documents, API access, and the first imported week. The calendar
shows a setup prompt for owners/admins until those required checks are complete.

## Families, Roles, And Voting

Meal plans belong to a family. The first seeded user becomes the family owner, and `/family` lets owners/admins add more members by email with a temporary password.

Roles:

- `OWNER`: manage family members, owner roles, API keys, guidance, meal plans, rejected meals, and votes.
- `ADMIN`: manage non-owner members, API keys, guidance, meal plans, rejected meals, and votes.
- `MEMBER`: view shared plans, grocery lists, guidance, and cooking views; vote and comment on meals.

Temporary-password flow:

1. Owner/admin opens `/family`.
2. Add a member with email, display name, role, and a temporary password.
3. Share the temporary password outside the app. The app does not send email.
4. The member signs in and opens `/account` to change their password.

Owners/admins can reset another member's temporary password from `/family`. Owners can affect owner accounts, but the last owner cannot be demoted or removed. Members can vote `Want`, `Okay`, or `No` on meals from the week detail or cook view, with an optional comment.

## Meal Memory

Everyone in the family can open `/meal-memory` to see a derived preference dashboard built from recent meals, votes, comments, closeout outcomes, feedback, and active rejected patterns. It highlights top wanted meals, bring-back candidates, avoid signals, member vote patterns, comment themes, actual cooked cost, and recent meals that worked well.

Owners/admins can use the dashboard quick actions to mark a meal as liked or save an avoid pattern into rejected meals. The page does not add a new persistence model; it reads the same family-scoped meal, vote, feedback, and rejection records already used by the planner brief.

## Week Review And Swaps

Every imported week has a derived review board at `/weeks/:weekId/review`. It shows day-by-day vote signals, active rejection matches, recent repeats, missing planning flags, budget summary, and ingredient impact before the week starts.

Family members can vote and comment from the review board. Owners/admins can replace a single dinner by pasting one outside-LLM recipe JSON object into the swap form for that date. A swap creates a fresh meal row for that day, so old votes and feedback do not carry over to the replacement. The ingredient rollup updates immediately, and `/ingredients` can reconcile the stored grocery list against the current meals.

## Week Closeout

Every week has a closeout board at `/weeks/:weekId/closeout`. It is the post-dinner companion to review mode: family members can leave final votes/comments, while owners/admins record what actually happened for each meal.

Closeout fields include outcome (`Needs closeout`, `Cooked`, `Leftovers`, `Skipped`, or `Replaced`), actual cost, outcome notes, leftover notes, and the meal-memory status/reason/tweaks. Rejected closeout feedback can also create a reusable rejected-meal pattern.

Saved closeouts update `/meal-memory`, `/planner`, and `GET /api/planning-brief` so future outside-LLM plans can see actual household outcomes rather than only planned dinners.

## Recipe Library

Every family has a cookbook at `/recipes`. Family members can browse saved recipes, while owners/admins can save proven meals from meal memory or week closeout, edit recipe details, and archive or restore recipes.

Saved recipes are curated copies of past meals, including ingredients, method steps, cost and prep estimates, planning flags, source meal metadata, and closeout feedback. Active saved recipes appear in `/planner`, `GET /api/planning-brief`, and `GET /api/household-profile` as household cookbook context. Owners/admins can also use saved recipes from `/weeks/:weekId/review` to replace one dinner without pasting outside-LLM JSON.

## Shared Shopping And Pantry

Every week has a shared checklist at `/weeks/:weekId/shopping`. It uses the stored grocery list when one exists, falls back to current meal ingredients when needed, and preserves item status by normalized grocery name after list refreshes. Any family member can mark items as needed, bought, or already on hand.

The shopping page is installable as part of the KitchenAlmanac PWA. Once a member opens a week's shopping list, that visited week is cached on the device for grocery-store use. Item-status changes made offline are queued locally and sync back when the device reconnects. Offline writes are limited to item status; pantry staple management still requires a connection.

Owners/admins can add and remove family pantry staples from the shopping page. Active staples make matching grocery items default to already on hand in shopping and appear as pantry context in ingredients, planning briefs, and household-profile API responses.

## Planning Brief Workflow

Owners/admins can open `/planner` to generate a persisted planning session for the next target week. The session stores the exact ChatGPT-ready prompt, local notes, and pasted weekly JSON so the manual ChatGPT Pro handoff can survive page reloads. The brief is derived on demand from the family guidance documents, active rejected meals, saved recipes, recent meal votes/comments, recent meal history, closeout outcomes, grocery lists, pantry staples, ingredient signals, and family members. It does not call an LLM.

Workflow:

1. Open `/planner`, adjust the target week and optional budget target.
2. Add any local-only notes, then save and copy the ChatGPT prompt.
3. Paste the prompt into ChatGPT and ask for weekly JSON.
4. Paste the returned JSON back into the same planning session.
5. Preview the import review, resolve blockers, then import the reviewed plan.

Members can view shared planning surfaces and vote on meals, but cannot generate planner sessions. Family API keys can fetch the same brief context from `GET /api/planning-brief`, and `/import` remains available as a standalone fallback for raw JSON imports.

## API Authentication

Create API keys in `/api-keys`. Use either header:

```http
Authorization: Bearer mp_prefix_secret
X-API-Key: mp_prefix_secret
```

API keys are shown once, stored only as hashes, and scoped to the family that created them.

## Core API

- `GET /api/household-profile`
- `GET /api/planning-brief?weekStart=YYYY-MM-DD&budgetTargetCents=35000`
- `POST /api/import/meal-plan`
- `GET /api/weeks`
- `POST /api/weeks`
- `GET /api/weeks/:weekId`
- `POST /api/weeks/:weekId/days/:date/meals`
- `PATCH /api/meals/:mealId`
- `POST /api/meals/:mealId/feedback`
- `GET /api/rejected-meals`
- `POST /api/rejected-meals`
- `PATCH /api/rejected-meals/:id`
- `POST /api/weeks/:weekId/grocery-list`

Dates use `YYYY-MM-DD`. V1 tracks dinners structurally; breakfast/lunch/snack support can be added later.

## Weekly JSON Import

The app can import the richer outside-LLM weekly JSON shape that contains:

- `schema_version`
- `input_summary`
- `weekly_overview`
- `shopping_list`
- `recipes`

Human users can paste it at `/import`.

The import page previews the returned JSON before saving. The review shows the
seven-day dinner spread, grocery item count, estimated grocery total versus the
latest family budget target, active rejected-meal matches, repeated recent meals,
vote-aware notes, and missing planning flags. Duplicate dinner dates or dinners
that map outside the target week are blockers and must be resolved before import.

Use `/ingredients` after importing, planning, or swapping a week to see normalized ingredient totals, day-by-day recipe amounts, pantry signals, and grocery reconciliation. Owners/admins can refresh the stored grocery list from the current planned dinners; members can view the comparison.

Use `/weeks/:weekId/shopping` when shopping from the list. It is family-shared: status updates are visible to everyone in the household.

Use `/cook/:mealId` from the calendar or week detail view for a single-day cooking surface with ingredient checkoffs, step progress, timers, Cody/kid adaptations, equipment, nutrition, and leftover notes from the imported recipe JSON.

Use `/weeks/:weekId/review` before the week starts to spot No votes, active rejection matches, repeated recent meals, missing planning flags, and ingredient changes. Owners/admins can paste a single recipe JSON object there to swap one dinner without reimporting the whole week.

API callers can post either the raw plan with `?weekStart=YYYY-MM-DD`:

```bash
curl -X POST "http://localhost:3000/api/import/meal-plan?weekStart=2026-04-27" \
  -H "Authorization: Bearer mp_prefix_secret" \
  -H "Content-Type: application/json" \
  --data @weekly-plan.json
```

Or wrap it:

```json
{
  "weekStart": "2026-04-27",
  "plan": {
    "schema_version": "1.0",
    "weekly_overview": {},
    "shopping_list": {},
    "recipes": []
  }
}
```

The importer maps each recipe to the matching day in the week, stores the grocery list, preserves the full raw plan on the week, and preserves each full raw recipe on its meal.

`GET /api/household-profile` returns family-scoped household guidance, active rejected meals, family members, pantry staples, saved recipes, and recent meal-vote signals so an outside planner can account for household preferences.

`GET /api/planning-brief` returns `weekStart`, `weekEnd`, `generatedAt`, `family`, `briefMarkdown`, and structured `context` including active pantry staples and saved recipes. `weekStart` defaults to the next planning week. `budgetTargetCents` defaults to the most recent saved week budget when available.

## Example API Payloads

Create a week:

```json
{
  "weekStart": "2026-04-27",
  "title": "Week of 2026-04-27",
  "budgetTargetCents": 35000
}
```

Create or replace a dinner:

```json
{
  "name": "Turkey Black Bean Taco Bowls",
  "cuisine": "Mexican",
  "prepTimeActiveMinutes": 25,
  "prepTimeTotalMinutes": 35,
  "costEstimateCents": 1600,
  "servings": 7,
  "ingredients": [
    { "item": "93% lean ground turkey", "quantity": "2 lb" },
    { "item": "Low-sodium black beans", "quantity": "2 cans" }
  ],
  "methodSteps": [
    "Brown turkey with salt-free taco seasoning.",
    "Warm beans and vegetables.",
    "Serve over brown rice with toppings."
  ],
  "kidAdaptations": "Serve components separately for younger kids.",
  "batchPrepNote": "Cook extra brown rice for another bowl night.",
  "validation": {
    "diabetesFriendly": true,
    "heartHealthy": true,
    "noFishSafe": true,
    "kidFriendly": true,
    "budgetFit": true,
    "weeknightTimeSafe": true,
    "validationNotes": "Whole-grain base, lean protein, beans, and deconstructed kid option."
  }
}
```

## Verification

```bash
npm test
npm run lint
npm run build
```

## Manual QA Checklist

- Owner signs in, adds admin/member accounts with temporary passwords, resets a non-self member password, and removes a non-owner member.
- Member signs in with the temporary password, changes it from `/account`, views calendar/week/cook/grocery/guidance pages, and votes on a meal.
- Member cannot import plans, edit guidance, create API keys, or change roles.
- Admin can manage plans/API keys/guidance and non-owner members, but cannot demote/reset/remove owners.
- Owner cannot remove or demote the last owner.
- Vote counts/comments appear on calendar tiles, week detail, cook view, and in `/api/household-profile`.
- Family members open `/meal-memory` and see wanted meals, repeat candidates, avoid signals, member vote patterns, comment themes, and worked-well meals.
- Owner/admin uses `/meal-memory` to mark a meal as liked and save an avoid pattern; member users do not see those controls.
- Owner/admin opens `/planner`, changes week/budget, saves and copies the ChatGPT prompt, pastes returned JSON into the same session, previews the review, and imports the reviewed plan.
- Owner/admin saves a worked-well meal to `/recipes`, edits recipe details, archives/restores it, and sees active recipes in the planner brief.
- Owner/admin opens `/weeks/:weekId/review`, replaces one dinner from a saved recipe, and verifies the old votes disappear from the replacement.
- Owner/admin swaps a dinner from `/weeks/:weekId/review`, opens `/ingredients?weekId=...`, reviews added/removed/changed grocery items, refreshes the stored grocery list, and confirms week detail shows the updated list.
- Owner/admin opens `/weeks/:weekId/shopping`, marks items bought/already-have, adds a pantry staple, and sees matching items regroup.
- Member opens `/weeks/:weekId/shopping`, sees shared statuses, can update item status, and cannot manage pantry staples.
- Member opens `/weeks/:weekId/shopping`, goes offline, reloads the visited list, marks items bought/already-have, reconnects, and sees queued changes sync.
- Family members open `/weeks/:weekId/closeout`, add final votes/comments, and see outcome status for the week.
- Owner/admin saves cooked/skipped/leftover outcomes, actual cost, leftover notes, and meal-memory feedback from `/weeks/:weekId/closeout`; member users do not see those controls.
- Member cannot generate a planner brief; API keys can fetch `/api/planning-brief` for their family scope.
- Owner/admin pastes weekly JSON into `/import`, previews the plan, sees budget/rejection/repeat/vote/flag warnings, and cannot import duplicate-date or out-of-week dinners.
- Family members open `/weeks/:weekId/review`, vote/comment on meals, and see review warnings. Owner/admin swaps one dinner with single-recipe JSON and verifies old votes disappear from the replacement.

## Deployment Notes

`vercel.json` uses `prisma migrate deploy && next build` so production deployments apply migrations before the Next.js build. Confirm this checkout is linked with `.vercel/project.json` before deploying. The canonical production URL is `https://meals.dostal.co`; old MealPlanningApp aliases should not be reintroduced. Production seeding is intentionally separate; do not run `npm run db:seed` against production unless explicit `DATABASE_URL`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` values are provided.
