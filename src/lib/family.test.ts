import { describe, expect, it } from "vitest";

import {
  canChangeMemberRole,
  canManageApiKeys,
  canManageFamily,
  canManageOwnerRoles,
  canManagePlans,
  canRemoveMember,
  canResetMemberPassword,
} from "./family";

describe("family role permissions", () => {
  it("allows owners and admins to manage family planning surfaces", () => {
    expect(canManageFamily("OWNER")).toBe(true);
    expect(canManageFamily("ADMIN")).toBe(true);
    expect(canManageFamily("MEMBER")).toBe(false);

    expect(canManagePlans("OWNER")).toBe(true);
    expect(canManagePlans("ADMIN")).toBe(true);
    expect(canManagePlans("MEMBER")).toBe(false);

    expect(canManageApiKeys("OWNER")).toBe(true);
    expect(canManageApiKeys("ADMIN")).toBe(true);
    expect(canManageApiKeys("MEMBER")).toBe(false);
  });

  it("limits owner-role changes to owners", () => {
    expect(canManageOwnerRoles("OWNER")).toBe(true);
    expect(canManageOwnerRoles("ADMIN")).toBe(false);
    expect(canManageOwnerRoles("MEMBER")).toBe(false);
  });

  it("guards role changes that affect owners or the last owner", () => {
    expect(
      canChangeMemberRole({
        actorRole: "ADMIN",
        currentRole: "OWNER",
        nextRole: "ADMIN",
        ownerCount: 2,
      }),
    ).toBe(false);
    expect(
      canChangeMemberRole({
        actorRole: "OWNER",
        currentRole: "OWNER",
        nextRole: "ADMIN",
        ownerCount: 1,
      }),
    ).toBe(false);
    expect(
      canChangeMemberRole({
        actorRole: "OWNER",
        currentRole: "OWNER",
        nextRole: "ADMIN",
        ownerCount: 2,
      }),
    ).toBe(true);
    expect(
      canChangeMemberRole({
        actorRole: "ADMIN",
        currentRole: "MEMBER",
        nextRole: "ADMIN",
        ownerCount: 1,
      }),
    ).toBe(true);
  });

  it("allows password resets for managed members without allowing self resets", () => {
    expect(
      canResetMemberPassword({
        actorRole: "ADMIN",
        isSelf: false,
        targetRole: "MEMBER",
      }),
    ).toBe(true);
    expect(
      canResetMemberPassword({
        actorRole: "ADMIN",
        isSelf: false,
        targetRole: "OWNER",
      }),
    ).toBe(false);
    expect(
      canResetMemberPassword({
        actorRole: "OWNER",
        isSelf: true,
        targetRole: "OWNER",
      }),
    ).toBe(false);
  });

  it("prevents unsafe removals, including self removal and the last owner", () => {
    expect(
      canRemoveMember({
        actorRole: "ADMIN",
        isSelf: false,
        ownerCount: 1,
        targetRole: "MEMBER",
      }),
    ).toBe(true);
    expect(
      canRemoveMember({
        actorRole: "ADMIN",
        isSelf: false,
        ownerCount: 2,
        targetRole: "OWNER",
      }),
    ).toBe(false);
    expect(
      canRemoveMember({
        actorRole: "OWNER",
        isSelf: false,
        ownerCount: 1,
        targetRole: "OWNER",
      }),
    ).toBe(false);
    expect(
      canRemoveMember({
        actorRole: "OWNER",
        isSelf: true,
        ownerCount: 2,
        targetRole: "ADMIN",
      }),
    ).toBe(false);
  });
});
