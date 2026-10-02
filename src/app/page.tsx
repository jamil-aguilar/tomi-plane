import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { proyectosVisibles, unidadActiva, type ProyectoRow } from "@/lib/db";
import { SITUACIONES, STATES } from "@/lib/workflow";
import { BoardRail, dia, initials, vencida } from "@/components/rail";

function Tarjeta({ p, i, mostrarUnidad }: { p: ProyectoRow; i: number; mostrarUnidad: boolean }) {
  const e = p.actual;
  const tarde = vencida(e.fecha_fin, e.fecha_cierre);
  const hechas = p.etapas.filter((x) => x.situacion === "CERRADA").length;
  return (
    <li className="rise" style={{ animationDelay: `${90 + i * 25}ms` }}>
      <Link
        href={`/proyectos/${p.id}`}
        className="group block rounded-[7px] border border-line bg-surface p-3 transition-all hover:-translate-y-px"
        style={{
          borderLeft: `3px solid var(--st-${e.estado})`,
          boxShadow: `0 1px 2px color-mix(in oklab, var(--st-${e.estado}) 10%, transparent)`,
        }}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-mono text-[10px] text-mute">#{String(p.id).padStart(3, "0")}</span>
          <span className="flex min-w-0 items-center gap-1.5">
            {!p.publico && (
              <span
                className="shrink-0 font-mono text-[9px] tracking-wide uppercase"
                style={{ color: "var(--color-flag)" }}
                title="Reservado: no lo ven los dependientes"
              >
                reservado
              </span>
            )}
            {mostrarUnidad && (
              <span className="truncate font-mono text-[9.5px] text-mute">{p.unidad.nombre}</span>
            )}
          </span>
        </div>
        <p className="mt-1 text-[13.5px] leading-snug font-medium group-hover:underline group-hover:decoration-1 group-hover:underline-offset-2">
          {p.nombre}
        </p>

        <div className="mt-2 flex items-center gap-1.5" title={`${hechas} de 8 etapas cerradas`}>
          {p.etapas.map((x) => (
            <span
              key={x.id}
              className="h-1 flex-1 rounded-full"
              style={{
                background:
                  x.situacion === "CERRADA"
                    ? `var(--st-${x.estado})`
                    : x.id === e.id
                      ? `var(--st-${x.estado})`
                      : "var(--color-line)",
                opacity: x.situacion === "CERRADA" ? 0.45 : x.id === e.id ? 1 : 1,
              }}
            />
          ))}
        </div>

        <div className="mt-2.5 flex items-center gap-2">
          {e.responsable ? (
            <>
              <span
                className="grid h-5 w-5 place-items-center rounded-full font-mono text-[9px] font-semibold text-oncolor"
                style={{ background: `var(--st-${e.estado})` }}
                aria-hidden
              >
                {initials(e.responsable.name)}
              </span>
              <span className="truncate text-[11.5px] text-mute">{e.responsable.name}</span>
            </>
          ) : (
            <span className="font-mono text-[10.5px] text-mute opacity-70">sin responsable</span>
          )}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[10.5px]">
          {e.situacion === "SOLICITADA" && (
            <span className="font-mono tracking-wide text-stamp">cierre solicitado</span>
          )}
          {e.fecha_fin && (
            <span className="font-mono" style={{ color: tarde ? "var(--color-flag)" : "var(--color-mute)" }}>
              {tarde ? "vencida " : "plazo "}
              {dia(e.fecha_fin)}
            </span>
          )}
          {e._count.actividades > 0 && (
            <span className="font-mono text-mute">
              {e._count.actividades} act.
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}

export default async function Tablero() {
  const user = await requireUser();
  const { unidad, opciones } = await unidadActiva(user);
  const proyectos = await proyectosVisibles(user);

  if (!unidad && user.role !== "SA")
    return (
      <div className="max-w-xl">
        <h1 className="font-display text-[26px] font-black tracking-[-0.025em]">
          Todavía no tienes unidad
        </h1>
        <p className="mt-2 text-[13.5px] text-mute">
          Los proyectos pertenecen a una unidad. Pídele al Super Administrador que te agregue a la
          tuya y aparecerán aquí.
        </p>
      </div>
    );
  const counts = Object.fromEntries(
    STATES.map((s) => [s, proyectos.filter((p) => p.actual.estado === s).length]),
  );

  return (
    <div className="space-y-6">
      <section>
        <h1 className="font-mono text-[10px] tracking-[0.18em] text-mute uppercase">
          {unidad ? unidad.nombre : `Todas las unidades · ${opciones.length}`}
        </h1>
        <p className="mt-1 max-w-xl font-display text-[26px] leading-[1.15] font-black tracking-[-0.03em]">
          {proyectos.length === 0 ? (
            unidad ? (
              `Nada en circulación en ${unidad.nombre}.`
            ) : (
              "Nada en circulación todavía."
            )
          ) : (
            <>
              <span className="text-stamp">{proyectos.length}</span>{" "}
              {proyectos.length === 1 ? "proyecto" : "proyectos"} en circulación.
            </>
          )}
        </p>
        <div className="mt-4">
          <BoardRail counts={counts} />
        </div>
      </section>

      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
        <div className="flex min-h-[calc(100vh-17rem)] min-w-max gap-3">
          {STATES.map((s, i) => {
            const col = proyectos.filter((p) => p.actual.estado === s);
            const esperando = col.filter((p) => p.actual.situacion === "SOLICITADA").length;
            return (
              <section
                key={s}
                id={`col-${s}`}
                className="rise flex w-[232px] shrink-0 scroll-mx-6 flex-col overflow-hidden rounded-[10px] p-2.5 pt-2"
                style={{
                  animationDelay: `${i * 30}ms`,
                  background: `color-mix(in oklab, var(--st-${s}) 11%, var(--color-sunken))`,
                  boxShadow: `inset 0 3px 0 0 var(--st-${s})`,
                }}
              >
                <header className="mb-2.5 px-0.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2
                      className="font-mono text-[11px] font-semibold tracking-[0.12em] uppercase"
                      style={{ color: `var(--st-${s})` }}
                    >
                      {s}
                    </h2>
                    <span
                      className="rounded-full px-1.5 py-0.5 font-mono text-[10.5px] font-semibold tabular-nums"
                      style={{
                        background: `color-mix(in oklab, var(--st-${s}) 16%, transparent)`,
                        color: `var(--st-${s})`,
                      }}
                    >
                      {col.length}
                    </span>
                  </div>
                  {col.length > 0 && (
                    <p className="mt-0.5 text-[11px] text-mute">
                      {esperando > 0
                        ? `${esperando} esperando al superior`
                        : SITUACIONES.EN_CURSO.toLowerCase()}
                    </p>
                  )}
                </header>
                <ul className="space-y-2">
                  {col.map((p, j) => (
                    <Tarjeta key={p.id} p={p} i={j} mostrarUnidad={!unidad} />
                  ))}
                </ul>
                {col.length === 0 && (
                  <p className="px-0.5 py-3 text-[11.5px] text-mute opacity-70">
                    {s === "PROPUESTA" && proyectos.length === 0
                      ? "Empieza por un proyecto."
                      : "Sin proyectos."}
                  </p>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
