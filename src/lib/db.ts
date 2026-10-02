import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient, type Actividad, type Etapa, type User } from "@/generated/prisma/client";
import { STATES, subtree, type Mandable, type Pertenencia } from "./workflow";

export type { Actividad, Etapa, User };
export { hashPassword, verifyPassword } from "./password";

// Una sola instancia por proceso: cada PrismaClient abre su propio pool.
const g = globalThis as unknown as { __prisma?: PrismaClient };

export const prisma: PrismaClient =
  g.__prisma ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

if (process.env.NODE_ENV !== "production") g.__prisma = prisma;

/** Unidades a las que pertenece la persona. El SA alcanza a todas. */
export async function unidadesDe(user: User) {
  if (user.role === "SA") return prisma.unidad.findMany({ orderBy: { nombre: "asc" } });
  return prisma.unidad.findMany({
    where: { miembros: { some: { user_id: user.id } } },
    orderBy: { nombre: "asc" },
  });
}

export const perteneceA = (user: User, unidad_id: number) =>
  user.role === "SA"
    ? Promise.resolve(true)
    : prisma.usuarioUnidad
        .findUnique({ where: { user_id_unidad_id: { user_id: user.id, unidad_id } } })
        .then(Boolean);

/**
 * La unidad en la que está parada la persona. Si no eligió ninguna, la primera
 * suya; el SA sin elección trabaja sobre todas.
 */
export async function unidadActiva(user: User) {
  const mias = await unidadesDe(user);
  const elegida = mias.find((u) => u.id === user.unidad_activa_id);
  if (elegida) return { unidad: elegida, opciones: mias };
  if (user.role === "SA") return { unidad: null, opciones: mias };
  return { unidad: mias[0] ?? null, opciones: mias };
}

/**
 * Qué proyectos alcanza: solo los de la unidad activa, y dentro de ella,
 * los reservados únicamente para quien manda.
 */
async function alcance(user: User): Promise<Prisma.ProyectoWhereInput | undefined> {
  const { unidad } = await unidadActiva(user);
  if (user.role === "SA") return unidad ? { unidad_id: unidad.id } : undefined;
  if (!unidad) return { id: -1 }; // no pertenece a ninguna unidad: no ve nada
  const base = { unidad_id: unidad.id };
  if (user.role === "SUP") return base;
  // DEP y OBS: lo público de su unidad. Reservado esconde el proyecto del resto
  // de la unidad, nunca de quien trabaja en él.
  return {
    AND: [
      base,
      {
        OR: [
          { publico: true },
          { created_by: user.id },
          { etapas: { some: { responsable_id: user.id } } },
        ],
      },
    ],
  };
}

const CON_GENTE = {
  unidad: { select: { id: true, nombre: true } },
  autor: { select: { id: true, name: true, manager_id: true } },
  etapas: {
    orderBy: { estado: "asc" },
    include: {
      responsable: { select: { id: true, name: true, manager_id: true } },
      _count: { select: { actividades: true } },
    },
  },
} as const;

type ProyectoCrudo = Awaited<
  ReturnType<typeof prisma.proyecto.findMany<{ include: typeof CON_GENTE }>>
>[number];

export type EtapaRow = ProyectoCrudo["etapas"][number];
export type ProyectoRow = ProyectoCrudo & {
  /** La etapa en curso o con cierre solicitado; si no hay, la última cerrada. */
  actual: EtapaRow;
};

const actualDe = (p: ProyectoCrudo): EtapaRow =>
  p.etapas.find((e) => e.situacion === "EN_CURSO" || e.situacion === "SOLICITADA") ??
  [...p.etapas].reverse().find((e) => e.situacion === "CERRADA") ??
  p.etapas[0];

export async function proyectosVisibles(user: User): Promise<ProyectoRow[]> {
  const filas = await prisma.proyecto.findMany({
    where: await alcance(user),
    include: CON_GENTE,
    orderBy: { id: "desc" },
  });
  return filas.map((p) => ({ ...p, actual: actualDe(p) }));
}

export async function proyectoVisible(user: User, id: number): Promise<ProyectoRow | undefined> {
  if (!Number.isInteger(id)) return undefined;
  const where = await alcance(user);
  const p = await prisma.proyecto.findFirst({
    where: where ? { AND: [{ id }, where] } : { id },
    include: CON_GENTE,
  });
  return p ? { ...p, actual: actualDe(p) } : undefined;
}

/** Lo que las reglas necesitan saber de una etapa. */
export const mando = (p: ProyectoRow, e: EtapaRow): Mandable => ({
  situacion: e.situacion,
  responsable_id: e.responsable_id,
  responsable_manager_id: e.responsable?.manager_id ?? null,
  autor_id: p.created_by,
  autor_manager_id: p.autor.manager_id,
});

export const pertenencia = (p: ProyectoRow): Pertenencia => ({
  autor_id: p.created_by,
  responsables: p.etapas.map((e) => e.responsable_id),
});

export const cumplimiento = (actividades: Actividad[]) => ({
  total: actividades.length,
  aprobadas: actividades.filter((a) => a.aprobada_at !== null).length,
});

/** A quién puede asignarle: la gente de la unidad activa, más su propio equipo. */
export async function asignables(user: User): Promise<User[]> {
  const { unidad } = await unidadActiva(user);
  if (user.role === "SA" && !unidad) return prisma.user.findMany({ orderBy: { name: "asc" } });
  const gente = await prisma.user.findMany({ select: { id: true, manager_id: true } });
  return prisma.user.findMany({
    where: {
      OR: [
        { id: { in: subtree(gente, user.id) } },
        ...(unidad ? [{ unidades: { some: { unidad_id: unidad.id } } }] : []),
      ],
    },
    orderBy: { name: "asc" },
  });
}

/** Deja constancia en la bitácora. Todo movimiento pasa por aquí. */
export function anotar(data: {
  user_id: number;
  accion: string;
  detalle?: string | null;
  proyecto_id?: number | null;
  etapa_id?: number | null;
  actividad_id?: number | null;
}) {
  return prisma.bitacora.create({ data });
}

export async function bitacoraDe(proyecto_id: number) {
  return prisma.bitacora.findMany({
    where: { proyecto_id },
    include: { user: { select: { name: true } }, etapa: { select: { estado: true } } },
    orderBy: { id: "desc" },
    take: 100,
  });
}

/** Crea el proyecto con sus ocho etapas; la primera arranca de inmediato. */
export async function crearProyecto(data: {
  nombre: string;
  detalle: string | null;
  publico: boolean;
  unidad_id: number;
  created_by: number;
  responsable_id: number | null;
}) {
  const ahora = new Date();
  return prisma.proyecto.create({
    data: {
      nombre: data.nombre,
      detalle: data.detalle,
      publico: data.publico,
      unidad_id: data.unidad_id,
      created_by: data.created_by,
      etapas: {
        create: STATES.map((estado, i) => ({
          estado,
          situacion: i === 0 ? ("EN_CURSO" as const) : ("PENDIENTE" as const),
          fecha_inicio: i === 0 ? ahora : null,
          responsable_id: i === 0 ? data.responsable_id : null,
        })),
      },
    },
    include: { etapas: true },
  });
}
