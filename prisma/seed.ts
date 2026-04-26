import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../src/lib/auth";
import { readSeedConfig } from "../src/lib/seed-config";
import { loadSkillReferenceDocuments } from "../src/lib/seed-documents";

const prisma = new PrismaClient();

async function main() {
  const seedConfig = readSeedConfig();

  const admin = await prisma.user.upsert({
    create: {
      email: seedConfig.adminEmail,
      name: "Household Admin",
      passwordHash: await hashPassword(seedConfig.adminPassword),
    },
    update: {},
    where: {
      email: seedConfig.adminEmail,
    },
  });

  const membership = await prisma.familyMember.findUnique({
    include: {
      family: true,
    },
    where: {
      userId: admin.id,
    },
  });
  const family =
    membership?.family ??
    (await prisma.family.create({
      data: {
        members: {
          create: {
            role: "OWNER",
            userId: admin.id,
          },
        },
        name: seedConfig.familyName,
      },
    }));
  const documents = await loadSkillReferenceDocuments(seedConfig.skillDir);

  for (const document of documents) {
    await prisma.householdDocument.upsert({
      create: {
        ...document,
        familyId: family.id,
      },
      update: {
        content: document.content,
        title: document.title,
      },
      where: {
        familyId_kind: {
          familyId: family.id,
          kind: document.kind,
        },
      },
    });
  }

  console.log(`Seeded KitchenAlmanac documents and admin user: ${seedConfig.adminEmail}`);
  console.log(`Seeded family: ${family.name}`);
  if (!process.env.ADMIN_PASSWORD && !seedConfig.isProductionSeed) {
    console.log("Default dev password: change-me-kitchenalmanac");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
