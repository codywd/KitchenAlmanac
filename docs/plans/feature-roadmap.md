# KitchenAlmanac Feature Roadmap

This document outlines the proposed improvements for the KitchenAlmanac application, focusing on reducing friction, enhancing data insights, and improving user experience.

*Note: Direct LLM integration (automated prompting/parsing) has been excluded from this plan.*

## 1. Automation & Friction Reduction
*   **Smart Grocery Reconciliation:** Implement "Smart Merge" logic that suggests items based on historical frequency (e.g., "You usually buy milk every 7 days; should I add it?").
*   **Recipe Web Scraping:** Add an "Import from URL" feature for the Recipe Library. Use an LLM to parse external URLs into the structured `Meal` schema to avoid manual JSON pasting.

## 2. Intelligence & Data Insights (Deepening "Meal Memory")
*   **Predictive "Avoid" Alerts:** Enhance the `/review` phase with "Predictive Warnings" based on historical trends (e.g., "You've had heavy pasta meals 3 times in the last 10 days; consider a lighter option").
*   **Cost Tracking & Analytics:** Build a "Financial Overview" dashboard in `/meal-memory` to visualize spending trends and "Planned vs. Actual" costs using existing `actualCostCents` data.
*   **Nutritional Trend Analysis:** Leverage existing validation flags (`diabetesFriendly`, `heartHealthy`, etc.) to provide a "Weekly Nutrition Score" and dietary goal tracking.

## 3. UX & Engagement
*   **"Kid Mode" / Simplified View:** A specialized, high-visual/low-text interface for children to facilitate voting and simplified cooking instructions.
*   **Gamified Voting:** Introduce "Streak" mechanics (e.g., "4-week budget streak!") to encourage consistent use of the voting and closeout systems.
*   **Enhanced "Cook" Mode:** Add a full-screen "Step-by-Step" mode for the `/cook/:mealId` page, potentially exploring voice commands for hands-free operation.

## 4. Technical & Operational Improvements
*   **Family Activity Feed:** Utilize the existing `AuditEvent` model to create a visible feed for owners/admins to track pantry updates, shopping changes, and member activity.
*   **Multi-Language Support (i18n):** Implement internationalization to support non-English speaking households.
