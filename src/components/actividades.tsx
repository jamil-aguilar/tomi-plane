import { CADENCIAS, avanceAtrasado, proximoAvance, type Cadencia } from "@/lib/workflow";
import { dia, iso, isoMinuto, when } from "./rail";
import { nuevaActividad, registrarAvance, visarActividad } from "@/app/actions";

export type ActividadConAvances = {
  id: number;
  nombre: string;
  detalle: string | null;
  fecha_inicio: Date;
  fecha_fin: Date | null;
  cadencia: string;
  aprobada_at: Date | null;
  visto_bueno: { name: string } | null;
  avances: { id: number; fecha: Date; porcentaje: number; nota: string | null; user: { name: string } }[];
};

const field =
  "rounded-[5px] border border-line bg-surface px-2.5 py-1.5 text-[13px] placeholder:text-mute focus:border-stamp focus:outline-none";
const label = "font-mono text-[10px] uppercase tracking-[0.14em] text-mute";

const porcentajeDe = (a: ActividadConAvances) => a.avances[0]?.porcentaje ?? 0;
const diaDe = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function Barra({ valor, cerrada }: { valor: number; cerrada: boolean }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-sunken" aria-hidden>
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${cerrada ? 100 : valor}%`,
          background: cerrada ? "var(--color-seal)" : "var(--color-stamp)",
        }}
      />
    </div>
  );
}

/** La actividad en foco: su programación, su avance y el formulario para reportar. */
function EnFoco({
  a,
  proyecto_id,
  etapa_id,
  puedeReportar,
  puedeVisar,
}: {
  a: ActividadConAvances;
  proyecto_id: number;
  etapa_id: number;
  puedeReportar: boolean;
  puedeVisar: boolean;
}) {
  const pct = porcentajeDe(a);
  const ultimo = a.avances[0] ?? null;
  const vence = proximoAvance(a, ultimo?.fecha ?? null);
  const atrasado = avanceAtrasado(a, ultimo?.fecha ?? null);
  const hoy = new Date();

  return (
    <article
      className="rounded-[8px] border bg-surface p-3.5"
      style={{ borderColor: atrasado ? "var(--color-flag)" : "var(--color-line)" }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-[15px] font-semibold">{a.nombre}</h3>
        <p className="font-mono text-[10.5px] text-mute">
          {dia(a.fecha_inicio)}
          {a.fecha_fin && ` → ${dia(a.fecha_fin)}`} · {CADENCIAS[a.cadencia as Cadencia]}
        </p>
      </div>
      {a.detalle && <p className="mt-1 text-[12.5px] text-mute">{a.detalle}</p>}

      <div className="mt-3 flex items-center gap-2.5">
        <Barra valor={pct} cerrada={false} />
        <span className="shrink-0 font-mono text-[12px] font-semibold tabular-nums">{pct}%</span>
      </div>

      <p className="mt-2 text-[11.5px]" style={{ color: atrasado ? "var(--color-flag)" : "var(--color-mute)" }}>
        {ultimo
          ? `Último reporte: ${when(ultimo.fecha)} por ${ultimo.user.name}`
          : "Todavía sin reportes de avance."}
        {vence && (atrasado ? ` · atrasado desde ${when(vence)}` : ` · próximo ${when(vence)}`)}
      </p>
      {ultimo?.nota && <p className="mt-1 text-[12.5px] italic">“{ultimo.nota}”</p>}

      {puedeReportar && (
        <form action={registrarAvance} className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3">
          <input type="hidden" name="proyecto_id" value={proyecto_id} />
          <input type="hidden" name="etapa_id" value={etapa_id} />
          <input type="hidden" name="actividad_id" value={a.id} />
          <label className="flex flex-col gap-1">
            <span className={label}>Momento</span>
            <input
              type="datetime-local"
              name="fecha"
              defaultValue={isoMinuto(hoy < diaDe(a.fecha_inicio) ? a.fecha_inicio : hoy)}
              min={`${iso(a.fecha_inicio)}T00:00`}
              max={a.fecha_fin ? `${iso(a.fecha_fin)}T23:59` : undefined}
              className={field}
            />
          </label>
          <label className="flex w-20 flex-col gap-1">
            <span className={label}>Avance %</span>
            <input
              type="number"
              name="porcentaje"
              min={0}
              max={100}
              step={1}
              required
              defaultValue={pct}
              className={field}
            />
          </label>
          <label className="flex min-w-[160px] flex-1 flex-col gap-1">
            <span className={label}>Qué se hizo</span>
            <input name="nota" placeholder="Opcional" className={field} />
          </label>
          <button className="rounded-[5px] bg-stamp px-3 py-1.5 text-[13px] font-semibold text-oncolor transition-opacity hover:opacity-90">
            Registrar avance
          </button>
        </form>
      )}

      {puedeVisar && (
        <form action={visarActividad} className="mt-2.5">
          <input type="hidden" name="proyecto_id" value={proyecto_id} />
          <input type="hidden" name="etapa_id" value={etapa_id} />
          <input type="hidden" name="actividad_id" value={a.id} />
          <button
            className="rounded-[5px] border px-3 py-1.5 text-[12.5px] font-medium transition-colors"
            style={{ borderColor: "var(--color-seal)", color: "var(--color-seal)" }}
          >
            Cerrar con visto bueno
          </button>
        </form>
      )}

      {a.avances.length > 1 && (
        <details className="mt-2.5">
          <summary className={`${label} hover:text-fg`}>
            Ver los {a.avances.length} reportes
          </summary>
          <ol className="mt-2 space-y-1.5 border-l border-line pl-3">
            {a.avances.map((v) => (
              <li key={v.id} className="text-[12px]">
                <span className="font-mono text-[11px] text-mute">{when(v.fecha)}</span>
                <span className="mx-1.5 font-semibold tabular-nums">{v.porcentaje}%</span>
                <span className="text-mute">{v.user.name}</span>
                {v.nota && <span className="block text-mute">{v.nota}</span>}
              </li>
            ))}
          </ol>
        </details>
      )}
    </article>
  );
}

function Fila({
  a,
  proyecto_id,
  etapa_id,
  puedeVisar,
}: {
  a: ActividadConAvances;
  proyecto_id: number;
  etapa_id: number;
  puedeVisar: boolean;
}) {
  const cerrada = a.aprobada_at !== null;
  return (
    <li className="flex items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{a.nombre}</p>
        <p className="font-mono text-[10.5px] text-mute">
          {dia(a.fecha_inicio)}
          {a.fecha_fin && ` → ${dia(a.fecha_fin)}`}
          {cerrada && a.visto_bueno && ` · VoBo de ${a.visto_bueno.name}`}
        </p>
      </div>
      <div className="w-20 shrink-0">
        <Barra valor={porcentajeDe(a)} cerrada={cerrada} />
      </div>
      <span className="w-9 shrink-0 text-right font-mono text-[11px] tabular-nums text-mute">
        {cerrada ? "✓" : `${porcentajeDe(a)}%`}
      </span>
      {puedeVisar && !cerrada && (
        <form action={visarActividad} className="shrink-0">
          <input type="hidden" name="proyecto_id" value={proyecto_id} />
          <input type="hidden" name="etapa_id" value={etapa_id} />
          <input type="hidden" name="actividad_id" value={a.id} />
          <button className="font-mono text-[10px] tracking-wide text-mute uppercase hover:text-stamp hover:underline">
            VoBo
          </button>
        </form>
      )}
      {puedeVisar && cerrada && (
        <form action={visarActividad} className="shrink-0">
          <input type="hidden" name="proyecto_id" value={proyecto_id} />
          <input type="hidden" name="etapa_id" value={etapa_id} />
          <input type="hidden" name="actividad_id" value={a.id} />
          <button className="font-mono text-[10px] tracking-wide text-mute uppercase hover:text-flag hover:underline">
            retirar
          </button>
        </form>
      )}
    </li>
  );
}

export function PanelActividades({
  proyecto_id,
  etapa,
  actividades,
  puedeRegistrar,
  puedeVisar,
}: {
  proyecto_id: number;
  etapa: { id: number; estado: string; fecha_inicio: Date | null; fecha_fin: Date | null };
  actividades: ActividadConAvances[];
  puedeRegistrar: boolean;
  puedeVisar: boolean;
}) {
  const ahora = new Date();
  const hoy = diaDe(ahora);
  const abiertas = actividades.filter((a) => !a.aprobada_at);

  // Se compara por día, no por hora: lo que empieza hoy ya está en curso hoy.
  const enCurso = abiertas.filter(
    (a) => diaDe(a.fecha_inicio) <= hoy && (!a.fecha_fin || diaDe(a.fecha_fin) >= hoy),
  );
  const vencidas = abiertas.filter((a) => a.fecha_fin !== null && diaDe(a.fecha_fin) < hoy);
  const proximas = abiertas.filter((a) => diaDe(a.fecha_inicio) > hoy);
  const cerradas = actividades.filter((a) => a.aprobada_at);
  const foco = [...vencidas, ...enCurso];
  const aprobadas = cerradas.length;

  const comun = { proyecto_id, etapa_id: etapa.id, puedeVisar };

  return (
    <section className="rounded-[7px] border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={label}>Actividades de {etapa.estado}</h2>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-mute">
            {aprobadas}/{actividades.length} con visto bueno
          </span>
          {puedeRegistrar && (
            <details className="relative">
              <summary className="rounded-[5px] border border-line px-2.5 py-1 text-[12.5px] font-medium transition-colors hover:border-stamp hover:text-stamp">
                + Nueva actividad
              </summary>
              <form
                action={nuevaActividad}
                className="absolute right-0 z-20 mt-2 w-[min(92vw,420px)] space-y-2.5 rounded-[8px] border border-line bg-surface p-3 shadow-xl"
              >
                <input type="hidden" name="proyecto_id" value={proyecto_id} />
                <input type="hidden" name="etapa_id" value={etapa.id} />
                <input name="nombre" required placeholder="Nombre de la actividad" className={`${field} w-full`} />
                <input name="detalle" placeholder="Detalle (opcional)" className={`${field} w-full`} />
                <div className="flex flex-wrap gap-2">
                  <label className="flex min-w-[130px] flex-1 flex-col gap-1">
                    <span className={label}>Inicio</span>
                    <input
                      type="date"
                      name="fecha_inicio"
                      required
                      min={iso(etapa.fecha_inicio)}
                      max={iso(etapa.fecha_fin)}
                      defaultValue={iso(etapa.fecha_inicio)}
                      className={field}
                    />
                  </label>
                  <label className="flex min-w-[130px] flex-1 flex-col gap-1">
                    <span className={label}>Fin</span>
                    <input
                      type="date"
                      name="fecha_fin"
                      min={iso(etapa.fecha_inicio)}
                      max={iso(etapa.fecha_fin)}
                      className={field}
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1">
                  <span className={label}>Reportar avance</span>
                  <select name="cadencia" defaultValue="DIARIA" className={`${field} w-full`}>
                    {Object.entries(CADENCIAS).map(([k, texto]) => (
                      <option key={k} value={k}>
                        {texto}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-[11.5px] text-mute">
                  Dentro del rango de la etapa
                  {etapa.fecha_fin ? `: ${dia(etapa.fecha_inicio)} → ${dia(etapa.fecha_fin)}` : ""}.
                </p>
                <button className="w-full rounded-[5px] bg-stamp px-3 py-2 text-[13px] font-semibold text-oncolor transition-opacity hover:opacity-90">
                  Crear actividad
                </button>
              </form>
            </details>
          )}
        </div>
      </div>

      {actividades.length === 0 ? (
        <p className="mt-3 text-[13px] text-mute">
          La etapa empieza vacía. Registra las actividades que hay que cumplir dentro del plazo que
          fijó el superior.
        </p>
      ) : (
        <div className="mt-3 space-y-4">
          {foco.length > 0 && (
            <div className="space-y-2.5">
              <p className={label}>En curso</p>
              {foco.map((a) => (
                <EnFoco key={a.id} a={a} {...comun} puedeReportar={puedeRegistrar} />
              ))}
            </div>
          )}

          {foco.length === 0 && abiertas.length > 0 && (
            <p className="text-[13px] text-mute">
              Nada en curso hoy. La próxima empieza el {dia(proximas[0]?.fecha_inicio ?? null)}.
            </p>
          )}

          {proximas.length > 0 && (
            <div>
              <p className={label}>Programadas ({proximas.length})</p>
              <ul className="divide-y divide-line">
                {proximas.map((a) => (
                  <Fila key={a.id} a={a} {...comun} />
                ))}
              </ul>
            </div>
          )}

          {cerradas.length > 0 && (
            <div>
              <p className={label}>Con visto bueno ({cerradas.length})</p>
              <ul className="divide-y divide-line">
                {cerradas.map((a) => (
                  <Fila key={a.id} a={a} {...comun} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
