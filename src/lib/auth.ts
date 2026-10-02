import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma, type User } from "./db";

const SECRET = process.env.AUTH_SECRET ?? "dev-secret-cambiar-en-produccion";
const sign = (v: string) => createHmac("sha256", SECRET).update(v).digest("base64url");

export async function setSession(id: number) {
  (await cookies()).set("sess", `${id}.${sign(String(id))}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  (await cookies()).delete("sess");
}

export async function currentUser(): Promise<User | null> {
  const raw = (await cookies()).get("sess")?.value;
  const [id, sig] = raw?.split(".") ?? [];
  if (!id || !sig) return null;
  const expected = sign(id);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
    return null;
  return prisma.user.findUnique({ where: { id: Number(id) } });
}

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}
