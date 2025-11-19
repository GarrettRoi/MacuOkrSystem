import { db } from "./db";
import { departments, subDepartments, staff } from "@shared/schema";

async function seed() {
  console.log("Seeding database...");

  const deptCount = await db.select().from(departments);
  if (deptCount.length > 0) {
    console.log("Database already seeded. Skipping...");
    return;
  }

  const [dept1] = await db.insert(departments).values({ name: "Academic Affairs" }).returning();
  const [dept2] = await db.insert(departments).values({ name: "Student Services" }).returning();
  const [dept3] = await db.insert(departments).values({ name: "Administration" }).returning();

  const [subDept1] = await db.insert(subDepartments).values({ 
    name: "Undergraduate Studies", 
    departmentId: dept1.id 
  }).returning();
  
  const [subDept2] = await db.insert(subDepartments).values({ 
    name: "Graduate Programs", 
    departmentId: dept1.id 
  }).returning();

  await db.insert(staff).values({
    name: "Dr. Sarah Johnson",
    email: "sarah.johnson@macu.edu",
    departmentId: dept1.id,
    subDepartmentId: subDept1.id,
  });

  await db.insert(staff).values({
    name: "Michael Chen",
    email: "michael.chen@macu.edu",
    departmentId: dept2.id,
    subDepartmentId: null,
  });

  await db.insert(staff).values({
    name: "Emily Rodriguez",
    email: "emily.rodriguez@macu.edu",
    departmentId: dept3.id,
    subDepartmentId: null,
  });

  console.log("✓ Database seeded successfully!");
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
