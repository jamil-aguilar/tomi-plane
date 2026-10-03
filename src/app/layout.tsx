import type { Metadata } from "next";
import Link from "next/link";
import { Roboto, Roboto_Mono } from "next/font/google";
import { currentUser } from "@/lib/auth";
import { unidadActiva } from "@/lib/db";
import { ROLES, canWrite } from "@/lib/workflow";
import { marca } from "@/lib/apariencia";
import { cambiarTema, elegirUnidad, logout } from "./actions";
import "./globals.css";

const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500", "700", "900"], variable: "--font-roboto" });
const robotoMono = Roboto_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-roboto-mono" });

export const metadata: Metadata = {
  title: "TOMY",
  description: "Unidades, proyectos y etapas: de la propuesta a producción",
};

/** El gato de TOMY. Los ojos son el color del azulejo asomando por debajo. */
function Gato({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        d="M6 14V5.2a.8.8 0 0 1 1.2-.7l5.3 3.1a12.4 12.4 0 0 1 7 0l5.3-3.1a.8.8 0 0 1 1.2.7V14a10 10 0 0 1-20 0Z"
        fill="currentColor"
      />
      <circle cx="12.3" cy="14.6" r="1.7" className="fill-stamp" />
      <circle cx="19.7" cy="14.6" r="1.7" className="fill-stamp" />
      <path d="M16 18.2a2 2 0 0 1-1.7-.9h3.4a2 2 0 0 1-1.7.9Z" className="fill-stamp" />
      <path
        d="M3 13.2h4M3 16.4h4M25 13.2h4M25 16.4h4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity=".55"
      />
    </svg>
  );
}

const navLink =
  "rounded-md px-2.5 py-1.5 text-[13px] font-medium whitespace-nowrap text-bar-fg/65 transition-colors hover:bg-white/10 hover:text-bar-fg";

const TEMA = { SYSTEM: ["Sistema", "◐"], LIGHT: ["Claro", "☀"], DARK: ["Oscuro", "☾"] } as const;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const [nombreTema, glifo] = TEMA[user?.theme ?? "SYSTEM"];
  // El color elegido pisa los tokens de la hoja de estilos, sin tocar el resto.
  const tono = user?.color ? marca(user.color, user.color_intensidad, user.color_alpha) : null;
  const { unidad, opciones } = user
    ? await unidadActiva(user)
    : { unidad: null, opciones: [] as { id: number; nombre: string }[] };

  const enlaces = user
    ? [
        { href: "/", texto: "Tablero", ver: true },
        { href: "/proyectos/nuevo", texto: "Nuevo proyecto", ver: canWrite(user) && (!!unidad || user.role === "SA") },
        { href: "/unidades", texto: "Unidades", ver: user.role === "SA" || user.role === "SUP" },
        { href: "/personas", texto: "Personas", ver: user.role === "SA" || user.role === "SUP" },
      ].filter((l) => l.ver)
    : [];

  return (
    <html
      lang="es"
      data-theme={user && user.theme !== "SYSTEM" ? user.theme.toLowerCase() : undefined}
      className={`${roboto.variable} ${robotoMono.variable}`}
      style={
        tono
          ? ({ "--color-stamp": tono.stamp, "--color-oncolor": tono.oncolor } as React.CSSProperties)
          : undefined
      }
    >
      <body className="min-h-screen">
        <header className="sticky top-0 z-30 border-b border-white/5 bg-bar text-bar-fg shadow-[0_1px_16px_-6px_rgba(0,0,0,0.6)]">
          <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-2 px-3 sm:gap-4 sm:px-6">
            <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="TOMY, inicio">
              <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-stamp text-oncolor shadow-[0_3px_12px_-3px_var(--color-stamp)]">
                <Gato className="h-[26px] w-[26px]" />
              </span>
              <span className="font-display text-[20px] leading-none font-black tracking-[-0.045em]">
                TOMY
              </span>
            </Link>

            {user && (
              <>
                {/* Unidad activa: decide qué proyectos se ven */}
                {(opciones.length > 0 || user.role === "SA") && (
                  <details className="relative min-w-0">
                    <summary className="flex max-w-[44vw] items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[12.5px] font-medium transition-colors hover:bg-white/10 sm:max-w-none">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-stamp" aria-hidden />
                      <span className="truncate">{unidad?.nombre ?? "Todas las unidades"}</span>
                      <span className="shrink-0 text-[9px] opacity-60" aria-hidden>
                        ▼
                      </span>
                    </summary>
                    <div className="absolute left-0 z-40 mt-2 max-h-[70vh] w-60 overflow-y-auto rounded-xl border border-line bg-surface p-1.5 text-fg shadow-xl">
                      <p className="px-2.5 py-1.5 font-mono text-[10px] tracking-[0.14em] text-mute uppercase">
                        Unidad
                      </p>
                      {user.role === "SA" && (
                        <form action={elegirUnidad}>
                          <button
                            className={`w-full rounded-md px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-sunken ${!unidad ? "font-semibold text-stamp" : ""}`}
                          >
                            Todas las unidades
                          </button>
                        </form>
                      )}
                      {opciones.map((u) => (
                        <form key={u.id} action={elegirUnidad}>
                          <input type="hidden" name="unidad_id" value={u.id} />
                          <button
                            className={`w-full rounded-md px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-sunken ${unidad?.id === u.id ? "font-semibold text-stamp" : ""}`}
                          >
                            {u.nombre}
                          </button>
                        </form>
                      ))}
                      {opciones.length === 0 && (
                        <p className="px-2.5 py-2 text-[12.5px] text-mute">
                          No perteneces a ninguna unidad.
                        </p>
                      )}
                    </div>
                  </details>
                )}

                <nav className="ml-2 hidden items-center gap-0.5 md:flex">
                  {enlaces.map((l) => (
                    <Link key={l.href} href={l.href} className={navLink}>
                      {l.texto}
                    </Link>
                  ))}
                </nav>

                <div className="ml-auto flex items-center gap-1.5">
                  <form action={cambiarTema}>
                    <button
                      className="grid h-8 w-8 place-items-center rounded-lg text-[14px] text-bar-fg/70 transition-colors hover:bg-white/10 hover:text-bar-fg"
                      title={`Tema: ${nombreTema}. Cambiar.`}
                      aria-label={`Tema ${nombreTema}, cambiar`}
                    >
                      {glifo}
                    </button>
                  </form>

                  {/* Perfil y salida; en celular guarda también la navegación */}
                  <details className="relative">
                    <summary className="flex items-center gap-2 rounded-lg py-1 pr-1 pl-1.5 transition-colors hover:bg-white/10">
                      <span
                        className="grid h-7 w-7 place-items-center rounded-full bg-stamp text-[11px] font-bold text-oncolor"
                        aria-hidden
                      >
                        {user.name
                          .split(/\s+/)
                          .map((w) => w[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </span>
                      <span className="hidden text-left leading-tight lg:block">
                        <span className="block max-w-[150px] truncate text-[12.5px] font-medium">
                          {user.name}
                        </span>
                        <span className="block font-mono text-[9.5px] tracking-wider text-bar-fg/50">
                          {user.role}
                        </span>
                      </span>
                      <span className="pr-1 text-[9px] opacity-60" aria-hidden>
                        ▼
                      </span>
                    </summary>
                    <div className="absolute right-0 z-40 mt-2 w-60 rounded-xl border border-line bg-surface p-1.5 text-fg shadow-xl">
                      <div className="px-2.5 py-2">
                        <p className="truncate text-[13px] font-semibold">{user.name}</p>
                        <p className="truncate text-[11.5px] text-mute">{ROLES[user.role]}</p>
                      </div>
                      <div className="my-1 h-px bg-line" />
                      <Link
                        href="/apariencia"
                        className="block rounded-md px-2.5 py-2 text-[13px] transition-colors hover:bg-sunken"
                      >
                        Apariencia
                      </Link>
                      <div className="my-1 h-px bg-line" />
                      <nav className="md:hidden">
                        {enlaces.map((l) => (
                          <Link
                            key={l.href}
                            href={l.href}
                            className="block rounded-md px-2.5 py-2 text-[13px] transition-colors hover:bg-sunken"
                          >
                            {l.texto}
                          </Link>
                        ))}
                        <div className="my-1 h-px bg-line" />
                      </nav>
                      <form action={logout}>
                        <button className="w-full rounded-md px-2.5 py-2 text-left text-[13px] text-flag transition-colors hover:bg-sunken">
                          Cerrar sesión
                        </button>
                      </form>
                    </div>
                  </details>
                </div>
              </>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-7 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
