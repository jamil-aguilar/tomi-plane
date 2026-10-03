import { STATES, SITUACIONES, type State } from "@/lib/workflow";

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

/** Fecha y hora cortas, para la bitácora. */
export const when = (d: Date) =>
  d.toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Solo la fecha, para plazos. */
export const dia = (d: Date | null) =>
  d ? d.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" }) : null;

const dosDigitos = (n: number) => String(n).padStart(2, "0");

/** Para rellenar <input type="date">, en hora local y no en UTC. */
export const iso = (d: Date | null) =>
  d ? `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}` : "";

/** Para rellenar <input type="datetime-local">. */
export const isoMinuto = (d: Date) =>
  `${iso(d)}T${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`;

export const vencida = (fin: Date | null, cierre: Date | null) =>
  fin !== null && (cierre ?? new Date()) > fin;

const dim = (s: string, pct: number) => `color-mix(in oklab, var(--st-${s}) ${pct}%, transparent)`;

/** Riel del tablero: cuántos proyectos hay detenidos en cada etapa, y salto a la columna. */
export function BoardRail({ counts }: { counts: Record<string, number> }) {
  return (
    <nav aria-label="Recorrido" className="flex items-stretch overflow-x-auto pb-1">
      {STATES.map((s) => {
        const n = counts[s] ?? 0;
        return (
          <a
            key={s}
            href={`#col-${s}`}
            className="group relative flex min-w-[84px] flex-1 flex-col gap-1.5 px-2 py-2 transition-colors first:pl-0 hover:bg-surface"
            style={{ borderTop: `2px solid ${n ? `var(--st-${s})` : "var(--color-line)"}` }}
          >
            <span
              className="font-display text-xl leading-none font-extrabold tabular-nums"
              style={{ color: n ? `var(--st-${s})` : "var(--color-mute)", opacity: n ? 1 : 0.4 }}
            >
              {String(n).padStart(2, "0")}
            </span>
            <span className="truncate font-mono text-[10px] tracking-[0.12em] text-mute uppercase group-hover:text-fg">
              {s}
            </span>
          </a>
        );
      })}
    </nav>
  );
}

export type Parada = {
  id: number;
  estado: State;
  situacion: string;
  fecha_inicio: Date | null;
  fecha_fin: Date | null;
  fecha_cierre: Date | null;
  responsable: { name: string } | null;
};

/**
 * Hoja de ruta del proyecto: las ocho etapas selladas con las iniciales de
 * quien las ejecutó, la que está en curso, y las que faltan.
 */
export function Riel({
  etapas,
  activa,
  mirando,
  href,
}: {
  etapas: Parada[];
  /** Índice de la etapa en curso. */
  activa: number;
  /** Id de la etapa que se está mirando, si no es la en curso. */
  mirando?: number;
  href?: (etapaId: number) => string;
}) {
  return (
    <ol aria-label="Etapas del proyecto" className="flex items-start gap-1">
      {etapas.map((e, i) => {
        const cerrada = e.situacion === "CERRADA";
        const aqui = i === activa;
        const seMira = mirando === e.id;
        const tarde = vencida(e.fecha_fin, e.fecha_cierre);
        const color = tarde && !cerrada ? "var(--color-flag)" : `var(--st-${e.estado})`;
        return (
          <li key={e.estado} className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5">
            {i > 0 && (
              <span
                aria-hidden
                className="absolute top-[13px] right-1/2 left-0 h-px"
                style={{ background: cerrada || aqui ? dim(e.estado, 35) : "var(--color-line)" }}
              />
            )}
            <Marca
              href={href?.(e.id)}
              className="relative flex h-[26px] w-[26px] items-center justify-center rounded-full font-mono text-[9.5px] font-semibold"
              style={{
                background: aqui ? color : cerrada ? dim(e.estado, 14) : "var(--color-surface)",
                color: aqui ? "var(--color-oncolor)" : cerrada ? `var(--st-${e.estado})` : "var(--color-mute)",
                border: aqui
                  ? "none"
                  : `1px ${cerrada ? "solid" : "dashed"} ${cerrada ? dim(e.estado, 45) : "var(--color-line)"}`,
                boxShadow: aqui
                  ? `0 0 0 3px ${dim(e.estado, 18)}`
                  : seMira
                    ? "0 0 0 2px var(--color-mute)"
                    : "none",
                opacity: cerrada || aqui ? 1 : 0.6,
              }}
              title={`${e.estado} · ${SITUACIONES[e.situacion as keyof typeof SITUACIONES]}${
                e.fecha_fin ? ` · plazo ${dia(e.fecha_fin)}` : ""
              }`}
            >
              {cerrada
                ? e.responsable
                  ? initials(e.responsable.name)
                  : "✓"
                : String(i + 1).padStart(2, "0")}
            </Marca>
            <span
              className="w-full truncate text-center font-mono text-[9px] tracking-wide uppercase"
              style={{ color: aqui ? color : "var(--color-mute)", opacity: aqui ? 1 : 0.6 }}
            >
              {e.estado}
            </span>
            {e.fecha_fin && (
              <span
                className="w-full truncate text-center font-mono text-[8.5px]"
                style={{ color: tarde && !cerrada ? "var(--color-flag)" : "var(--color-mute)" }}
                title={`Plazo ${dia(e.fecha_fin)}`}
              >
                {dia(e.fecha_fin)}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** La parada es un enlace cuando se puede abrir esa etapa; si no, un recuadro. */
function Marca({
  href,
  children,
  ...resto
}: { href?: string; children: React.ReactNode } & React.HTMLAttributes<HTMLElement>) {
  return href ? (
    <a href={href} {...resto}>
      {children}
    </a>
  ) : (
    <div {...resto}>{children}</div>
  );
}

export function StateTag({ state }: { state: string }) {
  return (
    <span
      className="inline-flex items-center rounded-[3px] px-2 py-1 font-mono text-[10px] font-semibold tracking-[0.1em] uppercase"
      style={{ background: `var(--st-${state})`, color: "var(--color-oncolor)" }}
    >
      {state}
    </span>
  );
}
