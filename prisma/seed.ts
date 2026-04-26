import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../src/lib/auth";
import { loadSkillReferenceDocuments } from "../src/lib/seed-documents";

const prisma = new PrismaClient();

async function main() {
  const skillDir =
    process.env.KITCHEN_ALMANAC_SKILL_DIR ??
    "/Users/cdostal/Downloads/Skills/KitchenAlmanac";
  const adminEmail = process.env.ADMIN_EMAIL ?? "cody@example.local";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "change-me-kitchenalmanac";
  const familyName = process.env.ADMIN_FAMILY_NAME ?? "KitchenAlmanac Household";

  const admin = await prisma.user.upsert({
    create: {
      email: adminEmail,
      name: "Household Admin",
      passwordHash: await hashPassword(adminPassword),
    },
    update: {},
    where: {
      email: adminEmail,
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
        name: familyName,
      },
    }));
  const documents = await loadSkillReferenceDocuments(skillDir);

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

  console.log(`Seeded KitchenAlmanac documents and admin user: ${adminEmail}`);
  console.log(`Seeded family: ${family.name}`);
  if (!process.env.ADMIN_PASSWORD) {
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
