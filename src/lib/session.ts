import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createSessionToken, hashSessionToken } from "./auth";
import { getDb } from "./db";

export const sessionCookieName = "kitchenalmanac_session";
const sessionDays = 30;

export type CurrentUser = {
  email: string;
  id: string;
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

  await getDb().session.create({
    data: {
      expiresAt,
      tokenHash: hashSessionToken(token),
      userId,
    },
  });

  return { expiresAt, token };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();

  cookieStore.set(sessionCookieName, token, {
    expires: expiresAt,
    httpOnly: true,
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

  return user;
}
