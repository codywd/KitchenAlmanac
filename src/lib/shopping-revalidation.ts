import { revalidatePath } from "next/cache";

export function revalidateShoppingSurfaces(weekId?: string) {
  if (weekId) {
    revalidatePath(`/weeks/${weekId}/shopping`);
  }

  revalidatePath("/ingredients");
  revalidatePath("/planner");
  revalidatePath("/weeks/[weekId]/shopping", "page");
}
