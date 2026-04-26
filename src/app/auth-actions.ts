"use server";

import { redirect } from "next/navigation";

import { verifyPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
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

  const user = await getDb().user.findUnique({
    where: {
      email,
    },
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    redirect(`/login?error=invalid&returnTo=${encodeURIComponent(returnTo)}`);
  }

  const session = await createSessionForUser(user.id);
  await setSessionCookie(session.token, session.expiresAt);
  redirect(returnTo);
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}
