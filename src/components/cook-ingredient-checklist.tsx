"use client";

import { CheckCircle2, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

import type { CookIngredient } from "@/lib/cook-view";

export function CookIngredientChecklist({
  ingredients,
}: {
  ingredients: CookIngredient[];
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const checkedCount = useMemo(
    () => ingredients.filter((ingredient) => checked[ingredient.id]).length,
    [checked, ingredients],
  );

  return (
    <section className="text-[var(--ink)]">
      <div className="flex items-end justify-between gap-4 border-b border-[var(--line)] pb-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--herb-dark)]">
            Mise en place
          </p>
          <h2 className="recipe-display mt-1 text-2xl font-semibold">
            Ingredients
          </h2>
        </div>
        <div className="flex items-center gap-2 text-sm font-black text-[var(--muted-ink)]">
          <CheckCircle2 size={16} />
          {checkedCount}/{ingredients.length}
        </div>
      </div>

      <div className="divide-y divide-[var(--line)]">
        {ingredients.map((ingredient) => (
          <label
            className="group grid min-h-20 cursor-pointer grid-cols-[auto_minmax(0,1fr)] gap-3 py-4 transition hover:bg-[rgba(255,253,245,0.56)]"
            key={ingredient.id}
          >
            <input
              checked={checked[ingredient.id] ?? false}
              className="mt-1 size-5 accent-[var(--herb)] transition-transform checked:scale-110"
              onChange={(event) =>
                setChecked((current) => ({
                  ...current,
                  [ingredient.id]: event.target.checked,
                }))
              }
              type="checkbox"
            />
            <span>
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold leading-5">{ingredient.name}</span>
                <span className="text-sm font-black text-[var(--tomato)]">
                  {ingredient.quantity}
                </span>
              </span>
              {ingredient.preparation ? (
                <span className="mt-1 block text-sm font-semibold leading-5 text-[var(--muted-ink)]">
                  {ingredient.preparation}
                </span>
              ) : null}
              <span className="mt-2 flex flex-wrap gap-2">
                {ingredient.pantryItem ? (
                  <span className="border-l-2 border-[var(--brass)] pl-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
                    pantry
                  </span>
                ) : null}
                {ingredient.optional ? (
                  <span className="border-l-2 border-[var(--brass)] pl-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
                    optional
                  </span>
                ) : null}
              </span>
              {ingredient.substitutes.length ? (
                <details className="mt-2 text-sm font-semibold text-[var(--muted-ink)]">
                  <summary className="cursor-pointer font-black text-[var(--herb-dark)]">
                    Substitutes
                  </summary>
                  <div className="mt-1 leading-5">
                    {ingredient.substitutes.join(", ")}
                  </div>
                </details>
              ) : null}
            </span>
          </label>
        ))}
      </div>

      <button
        className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-black text-[var(--herb-dark)] transition hover:text-[var(--ink)]"
        onClick={() => setChecked({})}
        type="button"
      >
        <RotateCcw size={16} />
        Reset
      </button>
    </section>
  );
}
