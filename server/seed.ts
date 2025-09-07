import bcrypt from "bcryptjs";
import { getDb } from "./db";
import { clients, quotes, followUps, users } from "@shared/schema";

async function main() {
  const db = getDb();
  if (!db) {
    console.log("DATABASE_URL non configurée. Seed ignoré.");
    process.exit(0);
  }

  // Admin user
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
  const adminPass = process.env.SEED_ADMIN_PASSWORD || "Admin1234";
  const passwordHash = await bcrypt.hash(adminPass, 10);
  await db
    .insert(users)
    .values({ name: "Admin", email: adminEmail, passwordHash, role: "admin" })
    .onConflictDoNothing({ target: users.email });

  // Clients
  const [c1] = await db
    .insert(clients)
    .values([
      { name: "Jean Dupont", company: "Acme SA", email: "jean@acme.fr", phone: "+33123456789", position: "Directeur" },
      { name: "Marie Curie", company: "BetaCorp", email: "marie@betacorp.fr", phone: "+33123456780", position: "CEO" },
    ])
    .returning();

  const allClients = await db.select().from(clients);
  const clientId = (allClients[0] as any).id as string;
  const today = new Date();
  const sentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 10)
    .toISOString()
    .split("T")[0];

  const [q1] = await db
    .insert(quotes)
    .values({
      reference: "DEV-2024-001",
      clientId,
      description: "Refonte site vitrine",
      amount: "12000.00",
      sentDate,
      status: "Accepté",
      notes: "Prioritaire",
      plannedFollowUpDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3)
        .toISOString()
        .split("T")[0],
      acceptedAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2)
        .toISOString()
        .split("T")[0],
    })
    .returning();

  await db.insert(followUps).values({
    quoteId: (q1 as any).id,
    date: sentDate,
    comment: "Envoi initial",
  });

  console.log("Seed terminé. Admin:", adminEmail, "mdp:", adminPass);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

