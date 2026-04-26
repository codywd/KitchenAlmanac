"use server";

import { recordAuditEvent } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { passwordChangeSchema } from "@/lib/schemas";
import { requireFamilyContext } from "@/lib/family";
import { getActionRequestMetadata } from "@/lib/request-context";
import { replaceSessionsForUser } from "@/lib/session";

export type PasswordChangeState = {
  error?: string;
  message?: string;
};

export async function changePasswordAction(
  _previousState: PasswordChangeState,
  formData: FormData,
): Promise<PasswordChangeState> {
  const context = await requireFamilyContext("/account");
  const requestMeta = await getActionRequestMetadata();
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
    await recordAuditEvent({
      actorUserId: context.user.id,
      familyId: context.family.id,
      outcome: "failure",
      requestMeta,
      subjectId: context.user.id,
      subjectType: "user",
      type: "auth.password_change",
    });
    return { error: "Current password did not match." };
  }

  await getDb().user.update({
    data: {
      mustChangePassword: false,
      passwordHash: await hashPassword(parsed.data.newPassword),
      passwordChangedAt: new Date(),
    },
    where: {
      id: context.user.id,
    },
  });
  await replaceSessionsForUser(context.user.id);
  await recordAuditEvent({
    actorUserId: context.user.id,
    familyId: context.family.id,
    outcome: "success",
    requestMeta,
    subjectId: context.user.id,
    subjectType: "user",
    type: "auth.password_change",
  });

  return { message: "Password updated." };
}
