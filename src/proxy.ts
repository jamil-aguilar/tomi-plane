import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, emitir, leer, opcionesCookie } from "@/lib/sesion";

/** Cada navegación renueva la ventana; lo que cierra la sesión es la inactividad. */
export function proxy(request: NextRequest) {
  const res = NextResponse.next();
  const actual = request.cookies.get(COOKIE)?.value;
  if (!actual) return res;

  const sesion = leer(actual);
  if (!sesion) {
    res.cookies.delete(COOKIE);
    return res;
  }
  // Se reescribe como mucho una vez por minuto, no en cada pedido.
  if (Date.now() - sesion.emitido > 60_000)
    res.cookies.set(COOKIE, emitir(sesion.id), opcionesCookie);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
