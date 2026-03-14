// Seed script placeholder — run with `npm run db:seed`
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // TODO: Add seed data for:
  // - Default admin user
  // - Sample compliance standards
  // - Default label taxonomy
  // - Default escalation rules

  console.log("✅ Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
