import { CADENCIAS, avanceAtrasado, proximoAvance, type Cadencia } from "@/lib/workflow";
import { dia, iso, isoMinuto, when } from "./rail";
import {
  borrarDocumento,
  editarAvance,
  eliminarAvance,
  editarActividad,
  eliminarActividad,
  finalizarActividad,
  nuevaActividad,
  registrarAvance,
  subirDocumento,
  visarActividad,
} from "@/app/actions";

export type ActividadConAvances = {
  id: number;
  nombre: string;
  detalle: string | null;
  fecha_inicio: Date;
  fecha_fin: Date | null;
  cadencia: string;
  finalizada_at: Date | null;
  aprobada_at: Date | null;
  visto_bueno: { name: string } | null;
  avances: {
    id: number;
    fecha: Date;
    porcentaje: number;
    nota: string | null;
    user_id: number;
    user: { name: string };
  }[];
  documentos: { id: number; nombre: string; bytes: number; subido_por: number }[];
};

const field =
  "rounded-[5px] border border-line bg-surface px-2.5 py-1.5 text-[13px] placeholder:text-mute focus:border-stamp focus:outline-none";
const label = "font-mono text-[10px] uppercase tracking-[0.14em] text-mute";

const porcentajeDe = (a: ActividadConAvances) => a.avances[0]?.porcentaje ?? 0;
const pesoKb = (b: number) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`;
const diaDe = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Verde con tilde cuando está cumplida; celeste con reloj mientras no. */
function Estado({ a, compacto = false }: { a: ActividadConAvances; compacto?: boolean }) {
  const hecha = a.aprobada_at !== null;
  const texto = hecha ? "Cumplida" : a.finalizada_at ? "Esperando visto bueno" : "Pendiente";
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{
        background: hecha ? "var(--color-hecho-fondo)" : "var(--color-pendiente-fondo)",
        color: hecha ? "var(--color-hecho)" : "var(--color-pendiente)",
      }}
      title={texto}
    >
      {hecha ? <Tilde /> : <Reloj />}
      {!compacto && texto}
    </span>
  );
}

function Tilde() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
      <path
        d="M3.5 8.4 6.4 11.3 12.5 5.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Reloj() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 4.6V8l2.3 1.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function Barra({ valor, cerrada }: { valor: number; cerrada: boolean }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-sunken" aria-hidden>
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${cerrada ? 100 : valor}%`,
          background: cerrada ? "var(--color-hecho)" : "var(--color-pendiente)",
        }}
      />
    </div>
  );
}

function Retoques({
  a,
  proyecto_id,
  etapa_id,
  etapa,
}: {
  a: ActividadConAvances;
  proyecto_id: number;
  etapa_id: number;
  etapa: { fecha_inicio: Date | null; fecha_fin: Date | null };
}) {
  const ocultos = (
    <>
      <input type="hidden" name="proyecto_id" value={proyecto_id} />
      <input type="hidden" name="etapa_id" value={etapa_id} />
      <input type="hidden" name="actividad_id" value={a.id} />
    </>
  );
  return (
    <div className="flex items-center gap-2">
      <details className="relative">
        <summary className="font-mono text-[10px] tracking-wide text-mute uppercase hover:text-stamp hover:underline">
          <span className="al-abrir">editar</span>
          <span className="al-cerrar text-stamp">cerrar</span>
        </summary>
        <form
          action={editarActividad}
          className="absolute right-0 z-20 mt-2 w-[min(92vw,380px)] space-y-2 rounded-[8px] border border-line bg-surface p-3 shadow-xl"
        >
          {ocultos}
          <input name="nombre" required defaultValue={a.nombre} className={`${field} w-full`} />
          <input
            name="detalle"
            defaultValue={a.detalle ?? ""}
            placeholder="Detalle (opcional)"
            className={`${field} w-full`}
          />
          <div className="flex flex-wrap gap-2">
            <label className="flex min-w-[120px] flex-1 flex-col gap-1">
              <span className={label}>Inicio</span>
              <input
                type="date"
                name="fecha_inicio"
                required
                defaultValue={iso(a.fecha_inicio)}
                min={iso(etapa.fecha_inicio)}
                max={iso(etapa.fecha_fin)}
                className={field}
              />
            </label>
            <label className="flex min-w-[120px] flex-1 flex-col gap-1">
              <span className={label}>Fin</span>
              <input
                type="date"
                name="fecha_fin"
                defaultValue={iso(a.fecha_fin)}
                min={iso(etapa.fecha_inicio)}
                max={iso(etapa.fecha_fin)}
                className={field}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className={label}>Reportar avance</span>
            <select name="cadencia" defaultValue={a.cadencia} className={`${field} w-full`}>
              {Object.entries(CADENCIAS).map(([k, texto]) => (
                <option key={k} value={k}>
                  {texto}
                </option>
              ))}
            </select>
          </label>
          <button className="w-full rounded-[5px] bg-stamp px-3 py-2 text-[13px] font-semibold text-oncolor transition-opacity hover:opacity-90">
            Guardar cambios
          </button>
        </form>
      </details>

      <details className="relative">
        <summary className="font-mono text-[10px] tracking-wide text-mute uppercase hover:text-flag hover:underline">
          <span className="al-abrir">eliminar</span>
          <span className="al-cerrar text-flag">cerrar</span>
        </summary>
        <form
          action={eliminarActividad}
          className="absolute right-0 z-20 mt-2 w-[min(92vw,280px)] space-y-2 rounded-[8px] border border-line bg-surface p-3 shadow-xl"
        >
          {ocultos}
          <p className="text-[12.5px] leading-snug">
            Se borra <strong className="font-semibold">{a.nombre}</strong> con sus avances y sus
            PDF. No se puede deshacer.
          </p>
          <button
            className="w-full rounded-[5px] px-3 py-2 text-[13px] font-semibold text-oncolor transition-opacity hover:opacity-90"
            style={{ background: "var(--color-flag)" }}
          >
            Sí, eliminar
          </button>
        </form>
      </details>
    </div>
  );
}

/** La actividad en foco: su programación, su avance y el formulario para reportar. */
function Tarjeta({
  a,
  proyecto_id,
  etapa_id,
  etapa,
  puedeReportar,
  puedeVisar,
}: {
  a: ActividadConAvances;
  proyecto_id: number;
  etapa_id: number;
  etapa: { fecha_inicio: Date | null; fecha_fin: Date | null };
  puedeReportar: boolean;
  puedeVisar: boolean;
}) {
  const pct = porcentajeDe(a);
  const ultimo = a.avances[0] ?? null;
  const vence = proximoAvance(a, ultimo?.fecha ?? null);
  const atrasado = avanceAtrasado(a, ultimo?.fecha ?? null);
  const hoy = new Date();
  const puedeCorregir = puedeReportar && !a.finalizada_at && !a.aprobada_at;

  return (
    <article
      className="rounded-[8px] border bg-surface p-3.5"
      style={{ borderColor: atrasado ? "var(--color-flag)" : "var(--color-line)" }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold">
          <Estado a={a} />
          {a.nombre}
        </h3>
        <div className="flex items-center gap-3">
          <p className="font-mono text-[10.5px] text-mute">
            {dia(a.fecha_inicio)}
            {a.fecha_fin && ` → ${dia(a.fecha_fin)}`} · {CADENCIAS[a.cadencia as Cadencia]}
          </p>
          {puedeReportar && (
            <Retoques a={a} proyecto_id={proyecto_id} etapa_id={etapa_id} etapa={etapa} />
          )}
        </div>
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

      {puedeCorregir && (
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

      <div className="mt-2.5 flex flex-wrap gap-2">
        {puedeReportar && (
          <form action={finalizarActividad}>
            <input type="hidden" name="proyecto_id" value={proyecto_id} />
            <input type="hidden" name="etapa_id" value={etapa_id} />
            <input type="hidden" name="actividad_id" value={a.id} />
            <button
              className="rounded-[5px] border border-line px-3 py-1.5 text-[12.5px] font-medium transition-colors hover:border-stamp hover:text-stamp"
            >
              {a.finalizada_at ? "Reabrir la actividad" : "Finalizar la actividad"}
            </button>
          </form>
        )}
        {puedeVisar && (
          <form action={visarActividad}>
            <input type="hidden" name="proyecto_id" value={proyecto_id} />
            <input type="hidden" name="etapa_id" value={etapa_id} />
            <input type="hidden" name="actividad_id" value={a.id} />
            <button
              className="rounded-[5px] border px-3 py-1.5 text-[12.5px] font-medium transition-colors"
              style={{ borderColor: "var(--color-seal)", color: "var(--color-seal)" }}
            >
              Dar el visto bueno
            </button>
          </form>
        )}
      </div>

      <div className="mt-3 border-t border-line pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={label}>Documentos (PDF, opcional)</span>
          {puedeReportar && (
            <form action={subirDocumento} className="flex items-center gap-2">
              <input type="hidden" name="proyecto_id" value={proyecto_id} />
              <input type="hidden" name="etapa_id" value={etapa_id} />
              <input type="hidden" name="actividad_id" value={a.id} />
              <input
                type="file"
                name="archivo"
                accept="application/pdf,.pdf"
                required
                className="max-w-[210px] text-[12px] file:mr-2 file:rounded-[4px] file:border file:border-line file:bg-sunken file:px-2 file:py-1 file:text-[12px]"
              />
              <button className="rounded-[5px] border border-line px-2.5 py-1 text-[12.5px] font-medium transition-colors hover:border-stamp hover:text-stamp">
                Adjuntar
              </button>
            </form>
          )}
        </div>
        {a.documentos.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {a.documentos.map((d) => (
              <li key={d.id} className="flex items-center gap-2 text-[12.5px]">
                <a
                  href={`/documentos/${d.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 truncate text-stamp hover:underline"
                >
                  {d.nombre}
                </a>
                <span className="shrink-0 font-mono text-[10.5px] text-mute">{pesoKb(d.bytes)}</span>
                <span className="shrink-0 text-mute" aria-hidden>·</span>
                {puedeReportar && (
                  <form action={borrarDocumento} className="shrink-0">
                    <input type="hidden" name="proyecto_id" value={proyecto_id} />
                    <input type="hidden" name="etapa_id" value={etapa_id} />
                    <input type="hidden" name="documento_id" value={d.id} />
                    <button className="font-mono text-[10px] tracking-wide text-mute uppercase hover:text-flag hover:underline">
                      quitar
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-[12px] text-mute">Sin documentos adjuntos.</p>
        )}
      </div>

      {a.avances.length > 0 && (
        <details className="mt-2.5">
          <summary className={`${label} hover:text-fg`}>
            {a.avances.length === 1 ? "Ver el reporte" : `Ver los ${a.avances.length} reportes`}
            {puedeCorregir && " · corregir"}
          </summary>
          <ol className="mt-2 space-y-2 border-l border-line pl-3">
            {a.avances.map((v) => (
              <li key={v.id} className="text-[12px]">
                <div className="flex flex-wrap items-baseline gap-x-1.5">
                  <span className="font-mono text-[11px] text-mute">{when(v.fecha)}</span>
                  <span className="font-semibold tabular-nums">{v.porcentaje}%</span>
                  <span className="text-mute">{v.user.name}</span>
                  {puedeCorregir && (
                    <details className="relative ml-auto">
                      <summary className="font-mono text-[10px] tracking-wide text-mute uppercase hover:text-stamp hover:underline">
                        <span className="al-abrir">corregir</span>
                        <span className="al-cerrar text-stamp">cerrar</span>
                      </summary>
                      <div className="absolute right-0 z-20 mt-2 w-[min(92vw,340px)] space-y-2 rounded-[8px] border border-line bg-surface p-3 shadow-xl">
                        <form action={editarAvance} className="space-y-2">
                          <input type="hidden" name="proyecto_id" value={proyecto_id} />
                          <input type="hidden" name="etapa_id" value={etapa_id} />
                          <input type="hidden" name="avance_id" value={v.id} />
                          <label className="flex flex-col gap-1">
                            <span className={label}>Momento</span>
                            <input
                              type="datetime-local"
                              name="fecha"
                              defaultValue={isoMinuto(v.fecha)}
                              min={`${iso(a.fecha_inicio)}T00:00`}
                              max={a.fecha_fin ? `${iso(a.fecha_fin)}T23:59` : undefined}
                              className={`${field} w-full`}
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className={label}>Avance %</span>
                            <input
                              type="number"
                              name="porcentaje"
                              min={0}
                              max={100}
                              required
                              defaultValue={v.porcentaje}
                              className={`${field} w-full`}
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className={label}>Qué se hizo</span>
                            <input
                              name="nota"
                              defaultValue={v.nota ?? ""}
                              placeholder="Opcional"
                              className={`${field} w-full`}
                            />
                          </label>
                          <button className="w-full rounded-[5px] bg-stamp px-3 py-1.5 text-[12.5px] font-semibold text-oncolor transition-opacity hover:opacity-90">
                            Guardar el avance
                          </button>
                        </form>
                        <form action={eliminarAvance}>
                          <input type="hidden" name="proyecto_id" value={proyecto_id} />
                          <input type="hidden" name="etapa_id" value={etapa_id} />
                          <input type="hidden" name="avance_id" value={v.id} />
                          <button
                            className="w-full rounded-[5px] border px-3 py-1.5 text-[12.5px] font-medium transition-colors"
                            style={{ borderColor: "var(--color-flag)", color: "var(--color-flag)" }}
                          >
                            Eliminar este reporte
                          </button>
                        </form>
                      </div>
                    </details>
                  )}
                </div>
                {v.nota && <span className="block text-mute">{v.nota}</span>}
              </li>
            ))}
          </ol>
        </details>
      )}
    </article>
  );
}

/** Resumen plegado: al abrirlo aparece la misma tarjeta que la etapa en curso. */
function Plegada({
  a,
  ...resto
}: {
  a: ActividadConAvances;
  proyecto_id: number;
  etapa_id: number;
  etapa: { fecha_inicio: Date | null; fecha_fin: Date | null };
  puedeReportar: boolean;
  puedeVisar: boolean;
}) {
  const cerrada = a.aprobada_at !== null;
  return (
    <li>
      <details className="group">
        <summary className="flex items-center gap-3 rounded-[6px] px-1 py-2 hover:bg-sunken">
          <Estado a={a} compacto />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium">{a.nombre}</span>
            <span className="block font-mono text-[10.5px] text-mute">
              {dia(a.fecha_inicio)}
              {a.fecha_fin && ` → ${dia(a.fecha_fin)}`}
              {cerrada && a.visto_bueno && ` · VoBo de ${a.visto_bueno.name}`}
              {a.documentos.length > 0 && ` · ${a.documentos.length} PDF`}
            </span>
          </span>
          <span className="w-20 shrink-0">
            <Barra valor={porcentajeDe(a)} cerrada={cerrada} />
          </span>
          <span className="w-9 shrink-0 text-right font-mono text-[11px] tabular-nums text-mute">
            {cerrada ? "100%" : `${porcentajeDe(a)}%`}
          </span>
          <span className="shrink-0 font-mono text-[10px] tracking-wide text-mute uppercase">
            <span className="al-abrir">abrir</span>
            <span className="al-cerrar text-stamp">cerrar</span>
          </span>
        </summary>
        <div className="pt-2 pb-1">
          <Tarjeta a={a} {...resto} />
        </div>
      </details>
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
  // Finalizadas por el responsable: ya no se trabajan, esperan al superior.
  const esperando = abiertas.filter((a) => a.finalizada_at);
  const foco = [...vencidas, ...enCurso].filter((a) => !a.finalizada_at);
  const aprobadas = cerradas.length;

  const comun = {
    proyecto_id,
    etapa_id: etapa.id,
    etapa,
    puedeVisar,
    puedeReportar: puedeRegistrar,
  };

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
                <span className="al-abrir">+ Nueva actividad</span>
                <span className="al-cerrar text-stamp">Cerrar</span>
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
                <Tarjeta key={a.id} a={a} {...comun} />
              ))}
            </div>
          )}

          {foco.length === 0 && proximas.length > 0 && (
            <p className="text-[13px] text-mute">
              Nada en curso hoy. La próxima empieza el {dia(proximas[0].fecha_inicio)}.
            </p>
          )}

          {esperando.length > 0 && (
            <div>
              <p className={label}>Finalizadas, esperando visto bueno ({esperando.length})</p>
              <ul className="divide-y divide-line">
                {esperando.map((a) => (
                  <Plegada key={a.id} a={a} {...comun} />
                ))}
              </ul>
            </div>
          )}

          {proximas.length > 0 && (
            <div>
              <p className={label}>Programadas ({proximas.length})</p>
              <ul className="divide-y divide-line">
                {proximas.map((a) => (
                  <Plegada key={a.id} a={a} {...comun} />
                ))}
              </ul>
            </div>
          )}

          {cerradas.length > 0 && (
            <div>
              <p className={label}>Con visto bueno ({cerradas.length})</p>
              <ul className="divide-y divide-line">
                {cerradas.map((a) => (
                  <Plegada key={a.id} a={a} {...comun} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
