"use server";

import { hashPassword, verifyPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { passwordChangeSchema } from "@/lib/schemas";
import { requireFamilyContext } from "@/lib/family";

export type PasswordChangeState = {
  error?: string;
  message?: string;
};

export async function changePasswordAction(
  _previousState: PasswordChangeState,
  formData: FormData,
): Promise<PasswordChangeState> {
  const context = await requireFamilyContext("/account");
  const parsed = passwordChangeSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });

  if (!parsed.success) {
    return { error: "Enter your current password and a new password with 8+ characters." };
  }

  const user = await getDb().user.findUniqueOrThrow({
    where: {
      id: context.user.id,
    },
  });

  if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    return { error: "Current password did not match." };
  }

  await getDb().user.update({
    data: {
      passwordHash: await hashPassword(parsed.data.newPassword),
    },
    where: {
      id: context.user.id,
    },
  });

  return { message: "Password updated." };
}
