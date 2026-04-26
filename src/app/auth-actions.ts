"use server";

import { redirect } from "next/navigation";

import { recordAuditEvent } from "@/lib/audit";
import { verifyPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { assertRateLimit, rateLimitPolicies } from "@/lib/rate-limit";
import { getActionRequestMetadata } from "@/lib/request-context";
import {
  clearSessionCookie,
  createSessionForUser,
  setSessionCookie,
} from "@/lib/session";

function safeReturnTo(value: FormDataEntryValue | null) {
  const path = typeof value === "string" ? value : "/calendar";

  return path.startsWith("/") && !path.startsWith("//") ? path : "/calendar";
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const returnTo = safeReturnTo(formData.get("returnTo"));
  const requestMeta = await getActionRequestMetadata();

  try {
    await assertRateLimit({
      policy: rateLimitPolicies.login,
      requestMeta,
      scope: "login",
      subject: `${email}:${requestMeta.ipHash ?? "unknown"}`,
    });
  } catch {
    redirect(`/login?error=invalid&returnTo=${encodeURIComponent(returnTo)}`);
  }

  const user = await getDb().user.findUnique({
    include: {
      familyMembership: {
        select: {
          familyId: true,
        },
      },
    },
    where: {
      email,
    },
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    await recordAuditEvent({
      familyId: user?.familyMembership?.familyId,
      metadata: {
        email,
      },
      outcome: "failure",
      requestMeta,
      subjectType: "user",
      type: "auth.login",
    });
    redirect(`/login?error=invalid&returnTo=${encodeURIComponent(returnTo)}`);
  }

  const session = await createSessionForUser(user.id);
  await setSessionCookie(session.token, session.expiresAt);
  await recordAuditEvent({
    actorUserId: user.id,
    familyId: user.familyMembership?.familyId,
    outcome: "success",
    requestMeta,
    subjectId: user.id,
    subjectType: "user",
    type: "auth.login",
  });
  redirect(user.mustChangePassword ? "/account?mustChangePassword=1" : returnTo);
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}
