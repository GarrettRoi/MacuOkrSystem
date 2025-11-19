import { db } from "./db";
import { spus, subUnits, staff } from "@shared/schema";

async function seed() {
  console.log("Seeding database...");

  const spuCount = await db.select().from(spus);
  if (spuCount.length > 0) {
    console.log("Database already seeded. Skipping...");
    return;
  }

  const [spu1] = await db.insert(spus).values({ name: "Academic Affairs" }).returning();
  const [spu2] = await db.insert(spus).values({ name: "Student Services" }).returning();
  const [spu3] = await db.insert(spus).values({ name: "Administration" }).returning();
  const [spu4] = await db.insert(spus).values({ name: "Information Technology" }).returning();

  const [subUnit1] = await db.insert(subUnits).values({ 
    name: "Undergraduate Studies", 
    spuId: spu1.id 
  }).returning();
  
  const [subUnit2] = await db.insert(subUnits).values({ 
    name: "Graduate Programs", 
    spuId: spu1.id 
  }).returning();

  await db.insert(staff).values({
    name: "Dr. Sarah Johnson",
    email: "sarah.johnson@macu.edu",
    spuId: spu1.id,
    subUnitId: subUnit1.id,
    isAdmin: true,
  });

  await db.insert(staff).values({
    name: "Michael Chen - Updated",
    email: "michael.chen@macu.edu",
    spuId: spu2.id,
    subUnitId: null,
  });

  await db.insert(staff).values({
    name: "Emily Rodriguez",
    email: "emily.rodriguez@macu.edu",
    spuId: spu3.id,
    subUnitId: null,
  });

  await db.insert(staff).values({
    name: "Jody Allen",
    email: "jody.allen@macu.edu",
    spuId: spu4.id,
    subUnitId: null,
  });

  console.log("✓ Database seeded successfully!");
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
