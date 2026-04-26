import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createSessionToken, hashSessionToken } from "./auth";
import { getDb } from "./db";

export const sessionCookieName = "kitchenalmanac_session";
const sessionDays = 30;

export type CurrentUser = {
  email: string;
  id: string;
  mustChangePassword: boolean;
  name: string | null;
};

function sessionExpiry() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + sessionDays);

  return expiresAt;
}

export async function createSessionForUser(userId: string) {
  const token = createSessionToken();
  const expiresAt = sessionExpiry();

  const session = await getDb().session.create({
    data: {
      expiresAt,
      tokenHash: hashSessionToken(token),
      userId,
    },
  });

  return { expiresAt, id: session.id, token };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();

  cookieStore.set(sessionCookieName, token, {
    expires: expiresAt,
    httpOnly: true,
    maxAge: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  if (token) {
    await getDb().session.deleteMany({
      where: {
        tokenHash: hashSessionToken(token),
      },
    });
  }

  cookieStore.delete(sessionCookieName);
}

export async function replaceSessionsForUser(userId: string) {
  const session = await createSessionForUser(userId);

  await getDb().session.deleteMany({
    where: {
      id: {
        not: session.id,
      },
      userId,
    },
  });
  await setSessionCookie(session.token, session.expiresAt);
}

export async function deleteSessionsForUser(userId: string) {
  await getDb().session.deleteMany({
    where: {
      userId,
    },
  });
}

export async function getUserForSessionToken(
  token?: string | null,
): Promise<CurrentUser | null> {
  if (!token) {
    return null;
  }

  const session = await getDb().session.findUnique({
    include: {
      user: {
        select: {
          email: true,
          id: true,
          mustChangePassword: true,
          name: true,
        },
      },
    },
    where: {
      tokenHash: hashSessionToken(token),
    },
  });

  if (!session || session.expiresAt <= new Date()) {
    if (session) {
      await getDb().session.delete({
        where: {
          id: session.id,
        },
      });
    }

    return null;
  }

  return session.user;
}

export async function getCurrentUser() {
  const cookieStore = await cookies();

  return getUserForSessionToken(cookieStore.get(sessionCookieName)?.value);
}

export async function requireCurrentUser(returnTo = "/calendar") {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  if (
    user.mustChangePassword &&
    returnTo !== "/account" &&
    !returnTo.startsWith("/account?")
  ) {
    redirect("/account?mustChangePassword=1");
  }

  return user;
}
