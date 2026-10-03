import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  asignables,
  bitacoraDe,
  cumplimiento,
  mando,
  pertenencia,
  prisma,
  proyectoVisible,
  type EtapaRow,
  type ProyectoRow,
} from "@/lib/db";
import {
  SITUACIONES,
  canWrite,
  esParteDelProyecto,
  isBoss,
  resolverError,
  solicitarError,
  vistoBuenoError,
} from "@/lib/workflow";
import { Riel, StateTag, dia, initials, iso, vencida, when } from "@/components/rail";
import { PanelActividades } from "@/components/actividades";
import { alternarVisibilidad, fijarEtapa, resolverCierre, solicitarCierre } from "../../actions";

const field =
  "w-full rounded-[4px] border border-line bg-surface px-3 py-2 text-[13.5px] placeholder:text-mute focus:border-stamp focus:outline-none";
const label = "font-mono text-[10px] uppercase tracking-[0.14em] text-mute";
const btn = "rounded-[4px] px-3.5 py-2 text-[13px] font-semibold transition-opacity hover:opacity-90";
const btnGhost =
  "rounded-[4px] border border-line px-3.5 py-2 text-[13px] font-medium transition-colors";

export default async function ProyectoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ e?: string; etapa?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { e: aviso, etapa: etapaPedida } = await searchParams;
  const p: ProyectoRow | undefined = await proyectoVisible(user, Number(id));
  if (!p) notFound();

  // Se puede mirar cualquier etapa del proyecto, no solo la que está en curso.
  const etapa: EtapaRow = p.etapas.find((x) => x.id === Number(etapaPedida)) ?? p.actual;
  const esActual = etapa.id === p.actual.id;
  const m = mando(p, etapa);
  const jefe = isBoss(m, user);
  // Quien no es parte del proyecto —y todo observador— solo ve el avance.
  const parte = esParteDelProyecto(pertenencia(p), m, user);

  const actividades = parte
    ? await prisma.actividad.findMany({
        where: { etapa_id: etapa.id },
        include: {
          visto_bueno: { select: { name: true } },
          avances: {
            include: { user: { select: { name: true } } },
            // user_id hace falta para saber quién puede corregir cada reporte.
            orderBy: [{ fecha: "desc" }, { id: "desc" }],
          },
          documentos: { orderBy: { id: "asc" } },
        },
        orderBy: [{ fecha_inicio: "asc" }, { id: "asc" }],
      })
    : [];
  const bitacoraCompleta = await bitacoraDe(p.id);
  // Sin pertenencia, la bitácora se recorta a los movimientos de etapa: el avance.
  const bitacora = parte
    ? bitacoraCompleta
    : bitacoraCompleta.filter((b) => b.accion.startsWith("ETAPA_") || b.accion.startsWith("PROYECTO_"));
  const cuenta = cumplimiento(actividades);
  const noPuedeSolicitar = solicitarError(m, user, cuenta);
  const noPuedeResolver = resolverError(m, user);
  const noPuedeVisar = vistoBuenoError(m, user);
  const gente = jefe ? await asignables(user) : [];
  const tarde = vencida(etapa.fecha_fin, etapa.fecha_cierre);

  return (
    <div className="space-y-7">
      <section className="rounded-[7px] border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="font-mono text-[11px] text-mute">#{String(p.id).padStart(3, "0")}</span>
          <StateTag state={etapa.estado} />
          <span className="font-mono text-[10px] tracking-wide text-mute uppercase">
            {SITUACIONES[etapa.situacion]}
          </span>
          <span className="font-mono text-[10px] tracking-wide text-mute">{p.unidad.nombre}</span>
          {!p.publico && (
            <span
              className="rounded-[3px] border px-1.5 py-0.5 font-mono text-[9.5px] tracking-wide uppercase"
              style={{ borderColor: "var(--color-flag)", color: "var(--color-flag)" }}
              title="Solo lo ven los superiores de la unidad"
            >
              Reservado
            </span>
          )}
          {jefe && (
            <form action={alternarVisibilidad}>
              <input type="hidden" name="proyecto_id" value={p.id} />
              <button className="font-mono text-[9.5px] tracking-wide text-mute uppercase underline-offset-2 hover:text-stamp hover:underline">
                {p.publico ? "reservar" : "hacer público"}
              </button>
            </form>
          )}
        </div>
        <h1 className="mt-3 font-display text-[27px] leading-[1.15] font-extrabold tracking-[-0.025em]">
          {p.nombre}
        </h1>
        <p className="mt-2 text-[12px] text-mute">
          Abierto por {p.autor.name} · {when(p.created_at)} · Responsable de la etapa:{" "}
          <strong className="font-semibold text-fg">{etapa.responsable?.name ?? "sin asignar"}</strong>
        </p>
        {p.detalle && <p className="mt-2 max-w-3xl text-[14px] leading-relaxed whitespace-pre-wrap">{p.detalle}</p>}
        <div className="mt-5 border-t border-line pt-4">
          <Riel
            etapas={p.etapas}
            activa={p.etapas.findIndex((x) => x.id === p.actual.id)}
            mirando={etapa.id}
            href={(e) => `/proyectos/${p.id}?etapa=${e}`}
          />
        </div>
      </section>

      {aviso && (
        <p className="rounded-[4px] border border-flag/40 px-3 py-2 text-[13px] text-flag">{aviso}</p>
      )}

      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          {!parte && (
            <section className="rounded-[7px] border border-line bg-surface p-4">
              <h2 className={label}>Solo lectura</h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-mute">
                {user.role === "OBS"
                  ? "Como observador puedes seguir el avance del proyecto, pero no ver ni modificar sus actividades."
                  : "No eres parte de este proyecto, así que ves su avance pero no sus actividades. Pide al superior de la etapa que te asigne como responsable."}
              </p>
            </section>
          )}

          {parte && (
          <>
          {!esActual && (
            <p className="rounded-[7px] border border-line bg-surface px-4 py-3 text-[13px] text-mute">
              Estás viendo la etapa <strong className="font-semibold text-fg">{etapa.estado}</strong>,
              que {etapa.situacion === "CERRADA" ? "ya está cerrada" : "todavía no empieza"}.{" "}
              <a href={`/proyectos/${p.id}`} className="text-stamp hover:underline">
                Ir a la etapa en curso
              </a>
              .
            </p>
          )}
          {esActual && (
          <>
          {/* ── Plazo de la etapa ────────────────────────────────── */}
          <section className="rounded-[7px] border border-line bg-surface p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className={label}>Etapa {etapa.estado}</h2>
              <p className="font-mono text-[11px]" style={{ color: tarde ? "var(--color-flag)" : "var(--color-mute)" }}>
                inicio {dia(etapa.fecha_inicio) ?? "—"} · plazo {dia(etapa.fecha_fin) ?? "sin fijar"}
                {tarde && " · VENCIDA"}
              </p>
            </div>
            {jefe ? (
              <form action={fijarEtapa} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="proyecto_id" value={p.id} />
                <input type="hidden" name="etapa_id" value={etapa.id} />
                <div className="min-w-[150px] flex-1 space-y-1.5">
                  <label htmlFor="fecha_fin" className={label}>
                    Plazo (opcional)
                  </label>
                  <input
                    id="fecha_fin"
                    type="date"
                    name="fecha_fin"
                    defaultValue={iso(etapa.fecha_fin)}
                    className={field}
                  />
                </div>
                <div className="min-w-[170px] flex-1 space-y-1.5">
                  <label htmlFor="responsable_id" className={label}>
                    Responsable
                  </label>
                  <select
                    id="responsable_id"
                    name="responsable_id"
                    defaultValue={etapa.responsable_id ?? ""}
                    className={field}
                  >
                    <option value="">Sin responsable</option>
                    {gente.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button className={`${btnGhost} hover:border-stamp hover:text-stamp`}>Guardar</button>
              </form>
            ) : (
              <p className="mt-2 text-[12.5px] text-mute">El superior fija el plazo y el responsable.</p>
            )}
          </section>

          </>
          )}

          <PanelActividades
            proyecto_id={p.id}
            etapa={etapa}
            actividades={actividades}
            puedeRegistrar={canWrite(user) && etapa.situacion !== "CERRADA"}
            puedeVisar={!noPuedeVisar}
          />

          {esActual && (
          <section className="rounded-[7px] border border-line bg-surface p-4">
            <h2 className={label}>Paso a la siguiente etapa</h2>

            {etapa.situacion === "SOLICITADA" ? (
              noPuedeResolver ? (
                <p className="mt-2 text-[12.5px] text-mute">
                  El cierre está solicitado. {noPuedeResolver}.
                </p>
              ) : (
                <form action={resolverCierre} className="mt-3 space-y-3">
                  <input type="hidden" name="proyecto_id" value={p.id} />
                  <input type="hidden" name="etapa_id" value={etapa.id} />
                  <textarea name="nota" rows={2} placeholder="Observación del superior" className={field} />
                  <div className="flex flex-wrap gap-2">
                    <button
                      name="decision"
                      value="aprobar"
                      className={`${btn} text-oncolor`}
                      style={{ background: "var(--color-seal)" }}
                    >
                      Aprobar y pasar a la siguiente
                    </button>
                    <button
                      name="decision"
                      value="devolver"
                      className={`${btnGhost} hover:border-flag hover:text-flag`}
                    >
                      Devolver al responsable
                    </button>
                  </div>
                </form>
              )
            ) : noPuedeSolicitar ? (
              <p className="mt-2 text-[12.5px] text-mute">{noPuedeSolicitar}.</p>
            ) : (
              <form action={solicitarCierre} className="mt-3 space-y-3">
                <input type="hidden" name="proyecto_id" value={p.id} />
                <input type="hidden" name="etapa_id" value={etapa.id} />
                <textarea name="nota" rows={2} placeholder="Qué se hizo en esta etapa" className={field} />
                <button className={`${btn} bg-stamp text-oncolor`}>
                  Solicitar el cierre de {etapa.estado}
                </button>
              </form>
            )}
          </section>
          )}
          </>
          )}
        </div>

        {/* ── Bitácora ───────────────────────────────────────────── */}
        <aside>
          <h2 className={label}>{parte ? "Bitácora" : "Avance"}</h2>
          <ol className="mt-3 space-y-0">
            {bitacora.map((b, i) => (
              <li key={b.id} className="flex gap-3 pb-4 last:pb-0">
                <div className="flex flex-col items-center">
                  <span
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full font-mono text-[9px] font-semibold text-oncolor"
                    style={{ background: `var(--st-${b.etapa?.estado ?? etapa.estado})` }}
                    aria-hidden
                  >
                    {initials(b.user.name)}
                  </span>
                  {i < bitacora.length - 1 && <span className="mt-1 w-px grow bg-line" />}
                </div>
                <div className="min-w-0 pb-1">
                  <p className="font-mono text-[10.5px] tracking-wide uppercase">
                    <span style={{ color: `var(--st-${b.etapa?.estado ?? etapa.estado})` }}>
                      {b.accion.replace(/_/g, " ")}
                    </span>
                    {b.etapa && <span className="text-mute"> · {b.etapa.estado}</span>}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-mute">
                    {b.user.name} · {when(b.at)}
                  </p>
                  {b.detalle && <p className="mt-1 text-[12.5px] leading-snug">{b.detalle}</p>}
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}
