import { describe, expect, it } from "vitest";

import {
  defaultDevAdminEmail,
  defaultDevAdminPassword,
  readSeedConfig,
} from "./seed-config";

describe("seed config", () => {
  it("uses explicit KitchenAlmanac dev defaults outside production", () => {
    const config = readSeedConfig({});

    expect(config.adminEmail).toBe(defaultDevAdminEmail);
    expect(config.adminPassword).toBe(defaultDevAdminPassword);
    expect(config.isProductionSeed).toBe(false);
    expect(config.skillDir).toContain("KitchenAlmanac");
  });

  it("requires an explicit opt-in before production seeding", () => {
    expect(() =>
      readSeedConfig({
        NODE_ENV: "production",
      }),
    ).toThrow("Production seeding is disabled by default.");
  });

  it("requires explicit production credentials and guidance source", () => {
    expect(() =>
      readSeedConfig({
        ALLOW_PRODUCTION_SEED: "true",
        NODE_ENV: "production",
      }),
    ).toThrow("ADMIN_EMAIL, ADMIN_PASSWORD, KITCHEN_ALMANAC_SKILL_DIR");
  });

  it("rejects dev defaults even when production seeding is explicitly enabled", () => {
    expect(() =>
      readSeedConfig({
        ADMIN_EMAIL: defaultDevAdminEmail,
        ADMIN_PASSWORD: defaultDevAdminPassword,
        ALLOW_PRODUCTION_SEED: "true",
        KITCHEN_ALMANAC_SKILL_DIR: "/tmp/kitchenalmanac",
        VERCEL_ENV: "production",
      }),
    ).toThrow("cannot use KitchenAlmanac dev defaults");
  });
});
