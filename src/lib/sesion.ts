import { createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE = "sess";

const SECRET = process.env.AUTH_SECRET ?? "dev-secret-cambiar-en-produccion";

/** Minutos de inactividad antes de cerrar la sesión. */
export const MINUTOS = Math.max(1, Number(process.env.SESION_MINUTOS ?? 60));
const VENTANA = MINUTOS * 60_000;

const firma = (cuerpo: string) => createHmac("sha256", SECRET).update(cuerpo).digest("base64url");

/** Valor de la cookie: id, momento de emisión y firma de ambos. */
export function emitir(id: number, emitido = Date.now()) {
  const cuerpo = `${id}.${emitido}`;
  return `${cuerpo}.${firma(cuerpo)}`;
}

/** null si la firma no cuadra o si la ventana de inactividad ya venció. */
export function leer(raw: string | undefined, ahora = Date.now()) {
  const partes = raw?.split(".") ?? [];
  if (partes.length !== 3) return null;
  const [id, emitido, sig] = partes;
  const esperada = firma(`${id}.${emitido}`);
  if (sig.length !== esperada.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(esperada)))
    return null;
  const t = Number(emitido);
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0 || !Number.isFinite(t)) return null;
  if (ahora - t > VENTANA) return null;
  return { id: n, emitido: t };
}

export const opcionesCookie = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: MINUTOS * 60,
};
