export const defaultDevAdminEmail = "cody@example.local";
export const defaultDevAdminPassword = "change-me-kitchenalmanac";
export const defaultDevFamilyName = "KitchenAlmanac Household";
export const defaultDevSkillDir = "/Users/cdostal/Downloads/Skills/KitchenAlmanac";

export type SeedConfig = {
  adminEmail: string;
  adminPassword: string;
  familyName: string;
  isProductionSeed: boolean;
  skillDir: string;
};

type SeedEnv = Record<string, string | undefined>;

function isProductionSeed(env: SeedEnv) {
  return env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
}

export function readSeedConfig(env: SeedEnv = process.env): SeedConfig {
  const productionSeed = isProductionSeed(env);
  const adminEmail = env.ADMIN_EMAIL ?? defaultDevAdminEmail;
  const adminPassword = env.ADMIN_PASSWORD ?? defaultDevAdminPassword;
  const familyName = env.ADMIN_FAMILY_NAME ?? defaultDevFamilyName;
  const skillDir = env.KITCHEN_ALMANAC_SKILL_DIR ?? defaultDevSkillDir;

  if (productionSeed) {
    if (env.ALLOW_PRODUCTION_SEED !== "true") {
      throw new Error(
        "Production seeding is disabled by default. Set ALLOW_PRODUCTION_SEED=true with explicit ADMIN_EMAIL, ADMIN_PASSWORD, and KITCHEN_ALMANAC_SKILL_DIR to continue.",
      );
    }

    const missing = [
      ["ADMIN_EMAIL", env.ADMIN_EMAIL],
      ["ADMIN_PASSWORD", env.ADMIN_PASSWORD],
      ["KITCHEN_ALMANAC_SKILL_DIR", env.KITCHEN_ALMANAC_SKILL_DIR],
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new Error(
        `Production seeding requires explicit values for: ${missing.join(", ")}.`,
      );
    }

    if (
      adminEmail === defaultDevAdminEmail ||
      adminPassword === defaultDevAdminPassword
    ) {
      throw new Error("Production seeding cannot use KitchenAlmanac dev defaults.");
    }
  }

  return {
    adminEmail,
    adminPassword,
    familyName,
    isProductionSeed: productionSeed,
    skillDir,
  };
}
