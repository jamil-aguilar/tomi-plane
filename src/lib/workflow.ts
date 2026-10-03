export const STATES = [
  "PROPUESTA",
  "APROBACION",
  "ANALISIS",
  "ASIGNACION",
  "DESARROLLO",
  "TEST",
  "VOBO",
  "PRODUCCION",
] as const;

export type State = (typeof STATES)[number];

/** Momento de una etapa dentro de su proyecto. */
export const SITUACIONES = {
  PENDIENTE: "Pendiente",
  EN_CURSO: "En curso",
  SOLICITADA: "Cierre solicitado",
  CERRADA: "Cerrada",
} as const;

export type Situacion = keyof typeof SITUACIONES;

export const ROLES = {
  SA: "Super Administrador",
  SUP: "Superior",
  DEP: "Dependiente",
  OBS: "Observador",
} as const;

export type Role = keyof typeof ROLES;

export const isRole = (r: string): r is Role => r in ROLES;

export const THEMES = ["SYSTEM", "LIGHT", "DARK"] as const;
export type Theme = (typeof THEMES)[number];

export function nextState(s: string): State | null {
  const i = (STATES as readonly string[]).indexOf(s);
  return i >= 0 && i < STATES.length - 1 ? STATES[i + 1] : null;
}

export function prevState(s: string): State | null {
  const i = (STATES as readonly string[]).indexOf(s);
  return i > 0 ? STATES[i - 1] : null;
}

/** Ids de una persona y de todos los que dependen de ella, directa o indirectamente. */
export function subtree(people: { id: number; manager_id: number | null }[], rootId: number): number[] {
  const ids = new Set([rootId]);
  // ponytail: barrido repetido sobre la lista de personas; basta de sobra para una planilla.
  for (let grew = true; grew; ) {
    grew = false;
    for (const p of people)
      if (p.manager_id !== null && ids.has(p.manager_id) && !ids.has(p.id)) {
        ids.add(p.id);
        grew = true;
      }
  }
  return [...ids];
}

export type Mover = { id: number; role: string };

/** Lo que hace falta saber de una etapa para decidir quién puede qué. */
export type Mandable = {
  situacion: string;
  responsable_id: number | null;
  responsable_manager_id: number | null;
  autor_id: number;
  autor_manager_id: number | null;
};

export const canWrite = (user: Mover) => user.role !== "OBS" && isRole(user.role);

/**
 * Superior de esta etapa: el SA, o el SUP que abrió el proyecto o es jefe
 * directo de quien lo abrió o de quien ejecuta la etapa.
 */
export function isBoss(e: Mandable, user: Mover): boolean {
  if (user.role === "SA") return true;
  return (
    user.role === "SUP" &&
    (user.id === e.autor_id ||
      user.id === e.autor_manager_id ||
      user.id === e.responsable_manager_id)
  );
}

/** Quien ejecuta: el responsable asignado, o el superior en su lugar. */
export const isEjecutor = (e: Mandable, user: Mover) =>
  canWrite(user) && (user.id === e.responsable_id || isBoss(e, user));

/** Lo que hace falta saber de un proyecto para decidir si alguien es parte de él. */
export type Pertenencia = { autor_id: number; responsables: (number | null)[] };

/**
 * Es parte del proyecto quien lo abrió, quien ejecuta alguna de sus etapas, o
 * el superior de esa gente. El observador nunca: solo mira el avance.
 */
export function esParteDelProyecto(p: Pertenencia, etapa: Mandable, user: Mover): boolean {
  if (user.role === "OBS") return false;
  return user.id === p.autor_id || p.responsables.includes(user.id) || isBoss(etapa, user);
}

export const CADENCIAS = {
  HORARIA: "Cada hora",
  DIARIA: "Cada día",
  SEMANAL: "Cada semana",
} as const;

export type Cadencia = keyof typeof CADENCIAS;

const INTERVALO: Record<Cadencia, number> = {
  HORARIA: 3_600_000,
  DIARIA: 86_400_000,
  SEMANAL: 604_800_000,
};

export type Reportable = {
  cadencia: string;
  fecha_inicio: Date;
  fecha_fin: Date | null;
  aprobada_at: Date | null;
};

/**
 * Cuándo vence el próximo reporte de avance. Se cuenta desde el último
 * reporte, o desde el inicio de la actividad si todavía no hay ninguno.
 * null = cerrada, ya no se reporta.
 */
export function proximoAvance(a: Reportable, ultimo: Date | null): Date | null {
  if (a.aprobada_at) return null;
  const desde = ultimo ?? a.fecha_inicio;
  return new Date(desde.getTime() + INTERVALO[a.cadencia as Cadencia]);
}

/** El reporte está atrasado si ya pasó su vencimiento. */
export function avanceAtrasado(a: Reportable, ultimo: Date | null, ahora = new Date()): boolean {
  const vence = proximoAvance(a, ultimo);
  return vence !== null && ahora > vence;
}

/**
 * Un avance se corrige mientras la actividad siga abierta: una vez finalizada
 * o visada, el historial queda como está.
 */
export function editarAvanceError(
  etapa: Mandable,
  a: { finalizada_at: Date | null; aprobada_at: Date | null },
  avance: { user_id: number },
  user: Mover,
): string | null {
  if (!canWrite(user)) return "Los observadores solo pueden consultar";
  if (etapa.situacion === "CERRADA") return "La etapa ya está cerrada";
  if (a.aprobada_at) return "La actividad ya tiene el visto bueno";
  if (a.finalizada_at) return "La actividad está finalizada; reábrela para corregir sus avances";
  if (avance.user_id !== user.id && !isBoss(etapa, user))
    return "Solo quien registró el avance o el superior puede corregirlo";
  return null;
}

/** Un avance vive dentro del período programado. null = válido. */
export function avanceError(a: Reportable, fecha: Date, porcentaje: number): string | null {
  if (a.aprobada_at) return "La actividad ya tiene el visto bueno; no admite más avances";
  if (Number.isNaN(fecha.getTime())) return "La fecha del avance no es válida";
  if (!Number.isInteger(porcentaje) || porcentaje < 0 || porcentaje > 100)
    return "El avance va de 0 a 100";
  if (fecha < startOf(a.fecha_inicio))
    return `La actividad empieza el ${corta(a.fecha_inicio)}; no se puede reportar antes`;
  if (a.fecha_fin && fecha > endOf(a.fecha_fin))
    return `La actividad termina el ${corta(a.fecha_fin)}; no se puede reportar después`;
  return null;
}

export type Editable = {
  aprobada_at: Date | null;
  created_by: number;
};

/**
 * Quién puede retocar o borrar una actividad: quien la creó, quien ejecuta la
 * etapa, o el superior. Una vez visada, solo el superior.
 */
export function editarActividadError(
  etapa: Mandable,
  a: Editable,
  user: Mover,
): string | null {
  if (!canWrite(user)) return "Los observadores solo pueden consultar";
  if (etapa.situacion === "CERRADA") return "La etapa ya está cerrada";
  if (a.aprobada_at && !isBoss(etapa, user))
    return "La actividad ya tiene el visto bueno; solo el superior puede cambiarla";
  if (user.id !== a.created_by && !isEjecutor(etapa, user))
    return "Solo el responsable de la etapa o quien la creó puede cambiarla";
  return null;
}

/** Finalizar es del responsable; el visto bueno sigue siendo del superior. */
export function finalizarError(etapa: Mandable, a: Editable, user: Mover): string | null {
  if (!canWrite(user)) return "Los observadores solo pueden consultar";
  if (etapa.situacion === "CERRADA") return "La etapa ya está cerrada";
  if (a.aprobada_at) return "La actividad ya tiene el visto bueno";
  if (!isEjecutor(etapa, user)) return "Solo el responsable de la etapa puede finalizarla";
  return null;
}

export type Cumplimiento = { total: number; aprobadas: number };

/** null = puede solicitar el cierre; string = por qué no. */
export function solicitarError(e: Mandable, user: Mover, act: Cumplimiento): string | null {
  if (!canWrite(user)) return "Los observadores solo pueden consultar";
  if (e.situacion === "SOLICITADA") return "El cierre ya está solicitado, espera al superior";
  if (e.situacion !== "EN_CURSO") return "Esta etapa no está en curso";
  if (!isEjecutor(e, user)) return "Solo el responsable de la etapa puede solicitar el cierre";
  const faltan = act.total - act.aprobadas;
  if (faltan > 0)
    return faltan === 1
      ? "Falta 1 actividad sin visto bueno"
      : `Faltan ${faltan} actividades sin visto bueno`;
  return null;
}

/** null = puede aprobar o devolver; string = por qué no. */
export function resolverError(e: Mandable, user: Mover): string | null {
  if (!canWrite(user)) return "Los observadores solo pueden consultar";
  if (e.situacion !== "SOLICITADA") return "Nadie ha solicitado el cierre de esta etapa";
  if (!isBoss(e, user)) return "Solo el superior puede aprobar o devolver";
  return null;
}

/** null = puede dar el visto bueno; string = por qué no. */
export function vistoBuenoError(e: Mandable, user: Mover): string | null {
  if (!canWrite(user)) return "Los observadores solo pueden consultar";
  if (e.situacion === "CERRADA") return "La etapa ya está cerrada";
  if (!isBoss(e, user)) return "Solo el superior da el visto bueno";
  return null;
}

/** Las fechas de una actividad viven dentro del rango de su etapa. null = válidas. */
export function rangoError(
  etapa: { fecha_inicio: Date | null; fecha_fin: Date | null },
  inicio: Date,
  fin: Date | null,
): string | null {
  if (Number.isNaN(inicio.getTime())) return "La fecha de inicio no es válida";
  if (fin && Number.isNaN(fin.getTime())) return "La fecha de fin no es válida";
  if (fin && fin < inicio) return "La fecha de fin es anterior a la de inicio";
  const desde = etapa.fecha_inicio;
  const hasta = etapa.fecha_fin;
  if (desde && inicio < dayStart(desde))
    return `La etapa empieza el ${fecha(desde)}; la actividad no puede empezar antes`;
  if (hasta && (fin ?? inicio) > dayEnd(hasta))
    return `La etapa vence el ${fecha(hasta)}; la actividad no puede terminar después`;
  return null;
}

const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const corta = (d: Date) => d.toLocaleDateString("es", { day: "numeric", month: "short" });

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayEnd = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const fecha = (d: Date) => d.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
