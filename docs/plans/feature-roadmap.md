# KitchenAlmanac Feature Roadmap

This document outlines the proposed improvements for the KitchenAlmanac application, focusing on reducing friction, enhancing data insights, and improving user experience.

*Note: Direct LLM integration (automated prompting/parsing) has been excluded from this plan.*

## 1. Automation & Friction Reduction
*   **Smart Grocery Reconciliation:** Implement "Smart Merge" logic that suggests items based on historical frequency (e.g., "You usually buy milk every 7 days; should I add it?").
*   **Recipe URL Import:** Add a later "Import from URL" feature for the Recipe Library using deterministic page metadata/schema extraction and manual review. Direct LLM URL parsing is intentionally out of scope.

## 2. Intelligence & Data Insights (Deepening "Meal Memory")
*   **Predictive "Avoid" Alerts:** Enhance the `/review` phase with "Predictive Warnings" based on historical trends (e.g., "You've had heavy pasta meals 3 times in the last 10 days; consider a lighter option").
*   **Cost Tracking & Analytics:** V1 lives at `/meal-memory/analytics` and visualizes weekly estimated cost, actual cost, budget target, deltas, expensive meals, and estimate misses from existing closeout data.
*   **Nutritional Trend Analysis:** V1 shows health-flag coverage and imported nutrition-estimate averages when source recipe JSON includes per-serving estimates. Nutrition goals and medical guidance remain out of scope.

## 3. UX & Engagement
*   **"Kid Mode" / Simplified View:** A specialized, high-visual/low-text interface for children to facilitate voting and simplified cooking instructions.
*   **Gamified Voting:** Introduce "Streak" mechanics (e.g., "4-week budget streak!") to encourage consistent use of the voting and closeout systems.
*   **Enhanced "Cook" Mode:** Add a full-screen "Step-by-Step" mode for the `/cook/:mealId` page, potentially exploring voice commands for hands-free operation.

## 4. Technical & Operational Improvements
*   **Family Activity Feed:** Utilize the existing `AuditEvent` model to create a visible feed for owners/admins to track pantry updates, shopping changes, and member activity.
*   **Multi-Language Support (i18n):** Implement internationalization to support non-English speaking households.
