import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintToolbar } from "@/app/weeks/[weekId]/menu/print-toolbar";
import { getDb } from "@/lib/db";
import { requireFamilyContext } from "@/lib/family";
import { buildWeeklyDinnerMenuView } from "@/lib/weekly-menu";

import styles from "./weekly-menu.module.css";

export const dynamic = "force-dynamic";

export default async function WeeklyDinnerMenuPage({
  params,
}: {
  params: Promise<{ weekId: string }>;
}) {
  const { weekId } = await params;
  const context = await requireFamilyContext(`/weeks/${weekId}/menu`);
  const week = await getDb().week.findFirst({
    include: {
      days: {
        include: {
          dinner: {
            select: {
              batchPrepNote: true,
              name: true,
              sourceRecipe: true,
              validationNotes: true,
            },
          },
        },
        orderBy: {
          date: "asc",
        },
      },
    },
    where: {
      familyId: context.family.id,
      id: weekId,
    },
  });

  if (!week) {
    notFound();
  }

  const menu = buildWeeklyDinnerMenuView(week);

  return (
    <main className={styles.root}>
      <div className={styles.toolbar}>
        <Link className={styles.backLink} href={`/weeks/${menu.weekId}`}>
          <ArrowLeft size={17} />
          Back to week
        </Link>
        <PrintToolbar />
      </div>

      <article aria-label="Weekly dinner menu" className={styles.sheet}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>Dinners only</p>
            <h1>Weekly Dinner Menu</h1>
          </div>
          <div className={styles.dateBlock}>
            <span>{menu.rangeLabel}</span>
            <small>{menu.weekTitle}</small>
          </div>
        </header>

        <section className={styles.daysGrid} aria-label="Dinner plan">
          {menu.days.map((day) => (
            <div
              className={styles.dayCard}
              data-empty={day.hasDinner ? "false" : "true"}
              key={day.date}
            >
              <div className={styles.dayMeta}>
                <span>{day.weekday}</span>
                <small>{day.dateLabel}</small>
              </div>
              <div className={styles.mealCopy}>
                <p className={styles.mealName}>{day.dinnerName}</p>
                {day.description ? (
                  <p className={styles.mealDescription}>{day.description}</p>
                ) : null}
              </div>
            </div>
          ))}
        </section>

        <section className={styles.prepPanel} aria-label="Prep notes">
          <div className={styles.prepHeader}>
            <p className={styles.kicker}>Prep Notes</p>
            <span>Small reminders for the day before dinner starts.</span>
          </div>
          <div className={styles.prepGrid}>
            {menu.days.map((day) => (
              <div
                className={styles.prepItem}
                data-empty={day.hasPrepNote ? "false" : "true"}
                key={`${day.date}-prep`}
              >
                <span>{day.weekday.slice(0, 3)}</span>
                <p>{day.prepNote}</p>
              </div>
            ))}
          </div>
        </section>
      </article>
    </main>
  );
}
