"use server";

import { revalidatePath } from "next/cache";

import { recordAuditEvent } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  assertCanManageFamily,
  canChangeMemberRole,
  canManageApiKeys,
  canManageOwnerRoles,
  canRemoveMember,
  canResetMemberPassword,
  requireFamilyContext,
} from "@/lib/family";
import { getActionRequestMetadata } from "@/lib/request-context";
import {
  familyMemberCreateSchema,
  familyMemberPasswordResetSchema,
  familyMemberRemoveSchema,
  familyMemberRoleUpdateSchema,
} from "@/lib/schemas";
import { deleteSessionsForUser } from "@/lib/session";

export type FamilyMemberActionState = {
  error?: string;
  message?: string;
};

export async function addFamilyMemberAction(
  _previousState: FamilyMemberActionState,
  formData: FormData,
): Promise<FamilyMemberActionState> {
  const context = await requireFamilyContext("/family");
  const requestMeta = await getActionRequestMetadata();
  assertCanManageFamily(context.role);

  const parsed = familyMemberCreateSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
    role: formData.get("role") || "MEMBER",
  });

  if (!parsed.success) {
    return { error: "Enter a valid email, role, and temporary password." };
  }

  const payload = parsed.data;

  if (payload.role === "OWNER" && !canManageOwnerRoles(context.role)) {
    return { error: "Only owners can add another owner." };
  }

  try {
    await getDb().$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        include: {
          familyMembership: true,
        },
        where: {
          email: payload.email,
        },
      });

      if (existingUser?.familyMembership) {
        if (existingUser.familyMembership.familyId === context.family.id) {
          throw new Error("That user is already in this family.");
        }

        throw new Error("That user already belongs to another family.");
      }

      const passwordHash = await hashPassword(payload.password);
      const user = existingUser
        ? await tx.user.update({
            data: {
              ...(payload.name ? { name: payload.name } : {}),
              mustChangePassword: true,
              passwordHash,
            },
            where: {
              id: existingUser.id,
            },
          })
        : await tx.user.create({
            data: {
              email: payload.email,
              mustChangePassword: true,
              name: payload.name || null,
              passwordHash,
            },
          });

      await tx.familyMember.create({
        data: {
          familyId: context.family.id,
          role: payload.role,
          userId: user.id,
        },
      });
    });

    revalidatePath("/family");
    await recordAuditEvent({
      actorUserId: context.user.id,
      familyId: context.family.id,
      metadata: {
        email: payload.email,
        role: payload.role,
      },
      outcome: "success",
      requestMeta,
      subjectType: "family-member",
      type: "family.member_add",
    });
    return { message: `Added ${payload.email} to ${context.family.name}.` };
  } catch (error) {
    await recordAuditEvent({
      actorUserId: context.user.id,
      familyId: context.family.id,
      metadata: {
        email: payload.email,
      },
      outcome: "failure",
      requestMeta,
      subjectType: "family-member",
      type: "family.member_add",
    });
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not add that family member.",
    };
  }
}

export async function updateFamilyMemberRoleAction(formData: FormData) {
  const context = await requireFamilyContext("/family");
  const requestMeta = await getActionRequestMetadata();
  assertCanManageFamily(context.role);
  const payload = familyMemberRoleUpdateSchema.parse({
    memberId: formData.get("memberId"),
    role: formData.get("role"),
  });

  const member = await getDb().familyMember.findFirstOrThrow({
    where: {
      familyId: context.family.id,
      id: payload.memberId,
    },
  });
  const ownerCount = await getDb().familyMember.count({
    where: {
      familyId: context.family.id,
      role: "OWNER",
    },
  });

  if (
    !canChangeMemberRole({
      actorRole: context.role,
      currentRole: member.role,
      nextRole: payload.role,
      ownerCount,
    })
  ) {
    throw new Error("You cannot make that role change.");
  }

  await getDb().$transaction(async (tx) => {
    await tx.familyMember.update({
      data: {
        role: payload.role,
      },
      where: {
        id: member.id,
      },
    });

    if (canManageApiKeys(member.role) && !canManageApiKeys(payload.role)) {
      await tx.apiKey.updateMany({
        data: {
          revokedAt: new Date(),
        },
        where: {
          createdByUserId: member.userId,
          familyId: context.family.id,
          revokedAt: null,
        },
      });
    }
  });

  revalidatePath("/family");
  await recordAuditEvent({
    actorUserId: context.user.id,
    familyId: context.family.id,
    metadata: {
      nextRole: payload.role,
      previousRole: member.role,
    },
    outcome: "success",
    requestMeta,
    subjectId: member.userId,
    subjectType: "family-member",
    type: "family.member_role_change",
  });
}

export async function resetFamilyMemberPasswordAction(formData: FormData) {
  const context = await requireFamilyContext("/family");
  const requestMeta = await getActionRequestMetadata();
  assertCanManageFamily(context.role);
  const payload = familyMemberPasswordResetSchema.parse({
    memberId: formData.get("memberId"),
    password: formData.get("password"),
  });
  const member = await getDb().familyMember.findFirstOrThrow({
    include: {
      user: {
        select: {
          id: true,
        },
      },
    },
    where: {
      familyId: context.family.id,
      id: payload.memberId,
    },
  });

  if (
    !canResetMemberPassword({
      actorRole: context.role,
      isSelf: member.user.id === context.user.id,
      targetRole: member.role,
    })
  ) {
    throw new Error("You cannot reset that member password.");
  }

  await getDb().user.update({
    data: {
      mustChangePassword: true,
      passwordHash: await hashPassword(payload.password),
    },
    where: {
      id: member.user.id,
    },
  });
  await deleteSessionsForUser(member.user.id);

  revalidatePath("/family");
  await recordAuditEvent({
    actorUserId: context.user.id,
    familyId: context.family.id,
    outcome: "success",
    requestMeta,
    subjectId: member.user.id,
    subjectType: "user",
    type: "auth.password_reset",
  });
}

export async function removeFamilyMemberAction(formData: FormData) {
  const context = await requireFamilyContext("/family");
  const requestMeta = await getActionRequestMetadata();
  assertCanManageFamily(context.role);
  const payload = familyMemberRemoveSchema.parse({
    memberId: formData.get("memberId"),
  });
  const member = await getDb().familyMember.findFirstOrThrow({
    include: {
      user: {
        select: {
          id: true,
        },
      },
    },
    where: {
      familyId: context.family.id,
      id: payload.memberId,
    },
  });
  const ownerCount = await getDb().familyMember.count({
    where: {
      familyId: context.family.id,
      role: "OWNER",
    },
  });

  if (
    !canRemoveMember({
      actorRole: context.role,
      isSelf: member.user.id === context.user.id,
      ownerCount,
      targetRole: member.role,
    })
  ) {
    throw new Error("You cannot remove that family member.");
  }

  await getDb().$transaction(async (tx) => {
    await tx.mealVote.deleteMany({
      where: {
        meal: {
          dayPlan: {
            week: {
              familyId: context.family.id,
            },
          },
        },
        userId: member.user.id,
      },
    });
    await tx.session.deleteMany({
      where: {
        userId: member.user.id,
      },
    });
    await tx.apiKey.updateMany({
      data: {
        revokedAt: new Date(),
      },
      where: {
        createdByUserId: member.user.id,
        familyId: context.family.id,
        revokedAt: null,
      },
    });
    await tx.familyMember.delete({
      where: {
        id: member.id,
      },
    });
  });

  revalidatePath("/family");
  await recordAuditEvent({
    actorUserId: context.user.id,
    familyId: context.family.id,
    outcome: "success",
    requestMeta,
    subjectId: member.user.id,
    subjectType: "family-member",
    type: "family.member_remove",
  });
}
