import { BookOpen } from "lucide-react";

import { saveMealToRecipeLibraryFormAction } from "@/app/recipe-actions";

export function SaveRecipeButton({
  label = "Save recipe",
  mealId,
}: {
  label?: string;
  mealId: string;
}) {
  return (
    <form action={saveMealToRecipeLibraryFormAction}>
      <input name="mealId" type="hidden" value={mealId} />
      <button className="ka-button-secondary gap-2">
        <BookOpen size={15} />
        {label}
      </button>
    </form>
  );
}
