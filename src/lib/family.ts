import type { FamilyRole } from "@prisma/client";

import { getDb } from "./db";
import { requireCurrentUser, type CurrentUser } from "./session";

export type FamilyContext = {
  family: {
    id: string;
    name: string;
  };
  role: FamilyRole;
  user: CurrentUser;
};

export const managedRoles = ["OWNER", "ADMIN", "MEMBER"] as const;

function defaultFamilyName(user: CurrentUser) {
  const name = user.name?.trim() || user.email.split("@")[0] || "Household";

  return `${name} Family`;
}

async function createDefaultFamilyForUser(user: CurrentUser) {
  return getDb().$transaction(async (tx) => {
    const family = await tx.family.create({
      data: {
        name: defaultFamilyName(user),
      },
    });

    const member = await tx.familyMember.create({
      data: {
        familyId: family.id,
        role: "OWNER",
        userId: user.id,
      },
    });

    return {
      family,
      role: member.role,
      user,
    };
  });
}

export async function getFamilyContextForUser(
  user: CurrentUser,
): Promise<FamilyContext> {
  const membership = await getDb().familyMember.findUnique({
    include: {
      family: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    where: {
      userId: user.id,
    },
  });

  if (!membership) {
    return createDefaultFamilyForUser(user);
  }

  return {
    family: membership.family,
    role: membership.role,
    user,
  };
}

export async function requireFamilyContext(returnTo = "/calendar") {
  const user = await requireCurrentUser(returnTo);

  return getFamilyContextForUser(user);
}

export function canManageFamily(role: FamilyRole) {
  return role === "OWNER" || role === "ADMIN";
}

export function canManageOwnerRoles(role: FamilyRole) {
  return role === "OWNER";
}

export function canManagePlans(role: FamilyRole) {
  return role === "OWNER" || role === "ADMIN";
}

export function canManageGuidance(role: FamilyRole) {
  return canManagePlans(role);
}

export function canManageApiKeys(role: FamilyRole) {
  return role === "OWNER" || role === "ADMIN";
}

export function canChangeMemberRole({
  actorRole,
  currentRole,
  nextRole,
  ownerCount,
}: {
  actorRole: FamilyRole;
  currentRole: FamilyRole;
  nextRole: FamilyRole;
  ownerCount: number;
}) {
  if (!canManageFamily(actorRole)) {
    return false;
  }

  if (
    (currentRole === "OWNER" || nextRole === "OWNER") &&
    !canManageOwnerRoles(actorRole)
  ) {
    return false;
  }

  if (currentRole === "OWNER" && nextRole !== "OWNER" && ownerCount <= 1) {
    return false;
  }

  return true;
}

export function canResetMemberPassword({
  actorRole,
  isSelf,
  targetRole,
}: {
  actorRole: FamilyRole;
  isSelf: boolean;
  targetRole: FamilyRole;
}) {
  if (isSelf || !canManageFamily(actorRole)) {
    return false;
  }

  return targetRole === "OWNER" ? canManageOwnerRoles(actorRole) : true;
}

export function canRemoveMember({
  actorRole,
  isSelf,
  ownerCount,
  targetRole,
}: {
  actorRole: FamilyRole;
  isSelf: boolean;
  ownerCount: number;
  targetRole: FamilyRole;
}) {
  if (isSelf || !canManageFamily(actorRole)) {
    return false;
  }

  if (targetRole === "OWNER") {
    return canManageOwnerRoles(actorRole) && ownerCount > 1;
  }

  return true;
}

export function assertCanManageFamily(role: FamilyRole) {
  if (!canManageFamily(role)) {
    throw new Error("Only family owners and admins can manage family settings.");
  }
}

export function assertCanManagePlans(role: FamilyRole) {
  if (!canManagePlans(role)) {
    throw new Error("Only family owners and admins can manage meal plans.");
  }
}

export function assertCanManageGuidance(role: FamilyRole) {
  if (!canManageGuidance(role)) {
    throw new Error("Only family owners and admins can manage planning guidance.");
  }
}

export function assertCanManageApiKeys(role: FamilyRole) {
  if (!canManageApiKeys(role)) {
    throw new Error("Only family owners and admins can manage API keys.");
  }
}
