import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { hashPassword } from "../src/lib/password.ts";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const email = (process.env.SA_EMAIL ?? "admin@local").toLowerCase();
const password = process.env.SA_PASSWORD ?? "admin123";

// Idempotente: se puede correr las veces que haga falta sin duplicar ni pisar la contraseña.
const sa = await prisma.user.upsert({
  where: { email },
  update: {},
  create: { name: "Super Administrador", email, password: hashPassword(password), role: "SA" },
});

console.log(`SA listo: ${sa.email} (id ${sa.id})`);
await prisma.$disconnect();
