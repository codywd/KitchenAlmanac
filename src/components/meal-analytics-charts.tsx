"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { MealAnalytics } from "@/lib/meal-analytics";

const colors = {
  actual: "#42663f",
  budget: "#917327",
  estimate: "#ba4f3a",
  grid: "rgba(49,45,36,0.14)",
  kid: "#558f88",
  line: "#312d24",
  nutrition: "#6e5aa8",
};

const pieColors = ["#42663f", "#558f88", "#ba4f3a", "#917327", "#7b7568"];

function dollars(value: unknown) {
  return typeof value === "number"
    ? new Intl.NumberFormat("en-US", {
        currency: "USD",
        maximumFractionDigits: 0,
        style: "currency",
      }).format(value / 100)
    : "Not estimated";
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

function ChartFrame({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div className="ka-panel border border-[var(--line)]">
      <h2 className="recipe-display text-2xl font-semibold text-[var(--ink)]">
        {title}
      </h2>
      <div className="mt-4 min-h-80">{children}</div>
    </div>
  );
}

export function MealAnalyticsCharts({ analytics }: { analytics: MealAnalytics }) {
  const weeklyCostData = analytics.weeklyCosts.map((week) => ({
    actual: week.actualCostCents,
    budget: week.budgetTargetCents,
    delta: week.costDeltaCents,
    estimate: week.estimatedCostCents,
    week: week.weekStart.slice(5),
  }));
  const healthData = analytics.healthFlagCoverage.map((week) => ({
    budget: week.budgetFit,
    diabetes: week.diabetesFriendly,
    heart: week.heartHealthy,
    kid: week.kidFriendly,
    planned: week.plannedDinners,
    week: week.weekStart.slice(5),
    weeknight: week.weeknightTimeSafe,
  }));
  const nutritionData = analytics.nutritionAverages.map((entry) => ({
    label: entry.label,
    sampleCount: entry.sampleCount,
    value: entry.value,
  }));

  return (
    <div className="grid gap-5">
      <ChartFrame title="Weekly Cost Trend">
        {weeklyCostData.length ? (
          <ComposedChart
            data={weeklyCostData}
            margin={{ bottom: 8, left: 6, right: 16, top: 12 }}
            responsive
            style={{ height: 320, width: "100%" }}
          >
            <CartesianGrid stroke={colors.grid} vertical={false} />
            <XAxis dataKey="week" />
            <YAxis tickFormatter={(value) => `$${Number(value) / 100}`} />
            <Tooltip formatter={(value) => dollars(value)} />
            <Legend />
            <Bar dataKey="estimate" fill={colors.estimate} name="Estimated" />
            <Bar dataKey="actual" fill={colors.actual} name="Actual" />
            <Line
              dataKey="budget"
              dot={false}
              name="Budget"
              stroke={colors.budget}
              strokeWidth={3}
              type="monotone"
            />
            <Line
              dataKey="delta"
              name="Actual vs closed estimate"
              stroke={colors.line}
              strokeDasharray="5 5"
              strokeWidth={2}
              type="monotone"
            />
          </ComposedChart>
        ) : (
          <p className="text-sm font-semibold text-[var(--muted-ink)]">
            Close out meals with cost data to populate this chart.
          </p>
        )}
      </ChartFrame>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartFrame title="Outcome Mix">
          {analytics.outcomeMix.length ? (
            <PieChart responsive style={{ height: 320, width: "100%" }}>
              <Pie
                data={analytics.outcomeMix.map((entry) => ({
                  ...entry,
                  label: statusLabel(entry.status),
                }))}
                dataKey="count"
                label={(entry) => {
                  const payload = entry.payload as {
                    count: number;
                    label: string;
                  };
                  return `${payload.label}: ${payload.count}`;
                }}
                nameKey="label"
                outerRadius={104}
              >
                {analytics.outcomeMix.map((entry, index) => (
                  <Cell
                    fill={pieColors[index % pieColors.length]}
                    key={entry.status}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          ) : (
            <p className="text-sm font-semibold text-[var(--muted-ink)]">
              Outcome counts appear after week closeout.
            </p>
          )}
        </ChartFrame>

        <ChartFrame title="Health Flag Coverage">
          {healthData.length ? (
            <BarChart
              data={healthData}
              margin={{ bottom: 8, left: 0, right: 16, top: 12 }}
              responsive
              style={{ height: 320, width: "100%" }}
            >
              <CartesianGrid stroke={colors.grid} vertical={false} />
              <XAxis dataKey="week" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="diabetes" fill={colors.actual} name="Diabetes" />
              <Bar dataKey="heart" fill={colors.estimate} name="Heart" />
              <Bar dataKey="kid" fill={colors.kid} name="Kid" />
              <Bar dataKey="budget" fill={colors.budget} name="Budget" />
              <Bar dataKey="weeknight" fill={colors.nutrition} name="Weeknight" />
            </BarChart>
          ) : (
            <p className="text-sm font-semibold text-[var(--muted-ink)]">
              Import or create planned dinners to populate this chart.
            </p>
          )}
        </ChartFrame>
      </div>

      <ChartFrame title="Imported Nutrition Averages">
        {nutritionData.length ? (
          <BarChart
            data={nutritionData}
            layout="vertical"
            margin={{ bottom: 8, left: 12, right: 24, top: 12 }}
            responsive
            style={{ height: 340, width: "100%" }}
          >
            <CartesianGrid stroke={colors.grid} horizontal={false} />
            <XAxis type="number" />
            <YAxis dataKey="label" type="category" width={96} />
            <Tooltip
              formatter={(value, _name, item) => [
                value,
                `${item.payload.sampleCount} sample${
                  item.payload.sampleCount === 1 ? "" : "s"
                }`,
              ]}
            />
            <Bar dataKey="value" fill={colors.nutrition} name="Average" />
          </BarChart>
        ) : (
          <p className="text-sm font-semibold text-[var(--muted-ink)]">
            Imported nutrition estimates appear when saved meal JSON includes them.
          </p>
        )}
      </ChartFrame>
    </div>
  );
}
