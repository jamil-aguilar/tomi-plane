import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma, type User } from "./db";
import { COOKIE, emitir, leer, opcionesCookie } from "./sesion";

export async function setSession(id: number) {
  (await cookies()).set(COOKIE, emitir(id), opcionesCookie);
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const sesion = leer((await cookies()).get(COOKIE)?.value);
  if (!sesion) return null;
  return prisma.user.findUnique({ where: { id: sesion.id } });
}

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}
