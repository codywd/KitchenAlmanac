import {
  removeFamilyMemberAction,
  resetFamilyMemberPasswordAction,
  updateFamilyMemberRoleAction,
} from "@/app/family-actions";
import { AppShell } from "@/components/app-shell";
import { FamilyMemberForm } from "@/components/family-member-form";
import { PageIntro } from "@/components/page-intro";
import { Section } from "@/components/section";
import {
  canChangeMemberRole,
  canManageFamily,
  canManageOwnerRoles,
  canRemoveMember,
  canResetMemberPassword,
  requireFamilyContext,
} from "@/lib/family";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const roleLabels = {
  ADMIN: "Admin",
  MEMBER: "Member",
  OWNER: "Owner",
};

export default async function FamilyPage() {
  const context = await requireFamilyContext("/family");
  const members = await getDb().familyMember.findMany({
    include: {
      user: {
        select: {
          email: true,
          id: true,
          name: true,
        },
      },
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    where: {
      familyId: context.family.id,
    },
  });
  const ownerCount = members.filter((member) => member.role === "OWNER").length;
  const canManage = canManageFamily(context.role);
  const canManageOwners = canManageOwnerRoles(context.role);

  return (
    <AppShell family={context.family} role={context.role} user={context.user}>
      <div className="ka-page">
        <PageIntro eyebrow="Shared household" title={context.family.name}>
          Family members share meal plans, grocery memory, planning guidance, and
          meal votes. New members sign in with the temporary password you set here,
          then change it from Account.
        </PageIntro>

        {canManage ? (
          <Section
            description="No email is sent from the app. Share the temporary password directly, then ask the member to change it from Account after their first login."
            title="Add Member"
          >
            <FamilyMemberForm canAddOwner={canManageOwners} />
          </Section>
        ) : null}

        <Section title="Members">
          <div className="ka-panel divide-y divide-[var(--line)]">
            {members.map((member) => {
              const lastOwner = member.role === "OWNER" && ownerCount <= 1;
              const isSelf = member.user.id === context.user.id;
              const canChangeThisRole =
                canChangeMemberRole({
                  actorRole: context.role,
                  currentRole: member.role,
                  nextRole: member.role,
                  ownerCount,
                }) && !lastOwner;
              const canResetThisPassword = canResetMemberPassword({
                actorRole: context.role,
                isSelf,
                targetRole: member.role,
              });
              const canRemoveThisMember = canRemoveMember({
                actorRole: context.role,
                isSelf,
                ownerCount,
                targetRole: member.role,
              });
              const roleOptions = canManageOwners
                ? (["OWNER", "ADMIN", "MEMBER"] as const)
                : (["ADMIN", "MEMBER"] as const);

              return (
                <div
                  className="flex flex-col justify-between gap-4 py-4 first:pt-0 last:pb-0 md:flex-row md:items-center"
                  key={member.id}
                >
                  <div>
                    <div className="text-lg font-black text-[var(--ink)]">
                      {member.user.name ?? member.user.email}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-[var(--muted-ink)]">
                      {member.user.email} / {roleLabels[member.role]}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 md:items-end">
                    {canChangeThisRole ? (
                      <form action={updateFamilyMemberRoleAction} className="flex gap-2">
                        <input name="memberId" type="hidden" value={member.id} />
                        <select
                          className="ka-select min-w-36"
                          defaultValue={member.role}
                          name="role"
                        >
                          {roleOptions.map((role) => (
                            <option key={role} value={role}>
                              {roleLabels[role]}
                            </option>
                          ))}
                        </select>
                        <button className="ka-button-secondary">
                          Update
                        </button>
                      </form>
                    ) : (
                      <span className="ka-status-mark" data-tone="muted">
                        {lastOwner ? "last owner" : isSelf ? "you" : roleLabels[member.role]}
                      </span>
                    )}
                    {canResetThisPassword ? (
                      <form
                        action={resetFamilyMemberPasswordAction}
                        className="flex flex-col gap-2 sm:flex-row"
                      >
                        <input name="memberId" type="hidden" value={member.id} />
                        <input
                          className="ka-field min-w-48 text-sm"
                          minLength={8}
                          name="password"
                          placeholder="New temp password"
                          required
                          type="password"
                        />
                        <button className="ka-button-secondary">
                          Reset
                        </button>
                      </form>
                    ) : null}
                    {canRemoveThisMember ? (
                      <form action={removeFamilyMemberAction}>
                        <input name="memberId" type="hidden" value={member.id} />
                        <button className="ka-button-danger">
                          Remove
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      </div>
    </AppShell>
  );
}
