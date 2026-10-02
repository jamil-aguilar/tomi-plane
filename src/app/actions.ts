"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { clearSession, requireUser, setSession } from "@/lib/auth";
import {
  anotar,
  crearProyecto,
  cumplimiento,
  hashPassword,
  mando,
  perteneceA,
  pertenencia,
  prisma,
  proyectoVisible,
  unidadActiva,
  verifyPassword,
} from "@/lib/db";
import {
  THEMES,
  avanceError,
  canWrite,
  esParteDelProyecto,
  isBoss,
  isRole,
  nextState,
  rangoError,
  type Cadencia,
  resolverError,
  solicitarError,
  vistoBuenoError,
  type Theme,
} from "@/lib/workflow";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => Number(str(fd, k)) || null;
const fecha = (fd: FormData, k: string) => (str(fd, k) ? new Date(`${str(fd, k)}T12:00:00`) : null);
/** <input type="datetime-local"> llega como 2026-10-12T09:30, sin zona. */
const momento = (fd: FormData, k: string) => (str(fd, k) ? new Date(str(fd, k)) : null);

const volver = (id: number, e?: string) =>
  redirect(`/proyectos/${id}${e ? `?e=${encodeURIComponent(e)}` : ""}`);

async function etapaDe(userId: number, proyectoId: number, etapaId: number) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const p = await proyectoVisible(user, proyectoId);
  if (!p) redirect("/");
  const e = p.etapas.find((x) => x.id === etapaId);
  if (!e) volver(p.id, "Esa etapa no pertenece al proyecto");
  return { user, p, e: e! };
}

// ── sesión ────────────────────────────────────────────────────────────────

export async function login(fd: FormData) {
  const email = str(fd, "email").toLowerCase();
  const u = await prisma.user.findUnique({ where: { email } });
  if (!u || !verifyPassword(str(fd, "password"), u.password)) redirect("/login?e=1");
  await setSession(u.id);
  redirect("/");
}

export async function logout() {
  await clearSession();
  redirect("/login");
}

/** Cambia la unidad en la que trabaja la persona. Solo entre las suyas. */
export async function elegirUnidad(fd: FormData) {
  const user = await requireUser();
  const destino = num(fd, "unidad_id");
  if (destino !== null && !(await perteneceA(user, destino))) redirect("/");
  await prisma.user.update({ where: { id: user.id }, data: { unidad_activa_id: destino } });
  revalidatePath("/", "layout");
  redirect("/");
}

/** Gira entre sistema, claro y oscuro, y lo guarda en el perfil. */
export async function cambiarTema() {
  const user = await requireUser();
  const siguiente = THEMES[(THEMES.indexOf(user.theme as Theme) + 1) % THEMES.length];
  await prisma.user.update({ where: { id: user.id }, data: { theme: siguiente } });
  revalidatePath("/", "layout");
}

// ── proyectos ─────────────────────────────────────────────────────────────

export async function nuevoProyecto(fd: FormData) {
  const user = await requireUser();
  if (!canWrite(user)) redirect("/");
  const nombre = str(fd, "nombre");
  const unidad_id = num(fd, "unidad_id");
  if (!nombre || !unidad_id) redirect("/proyectos/nuevo?e=1");
  if (!(await perteneceA(user, unidad_id))) redirect("/proyectos/nuevo?e=unidad");
  const p = await crearProyecto({
    nombre,
    detalle: str(fd, "detalle") || null,
    publico: str(fd, "publico") === "si",
    unidad_id,
    created_by: user.id,
    responsable_id: num(fd, "responsable_id"),
  });
  await anotar({
    user_id: user.id,
    accion: "PROYECTO_CREADO",
    detalle: nombre,
    proyecto_id: p.id,
    etapa_id: p.etapas[0].id,
  });
  redirect(`/proyectos/${p.id}`);
}

// ── etapas ────────────────────────────────────────────────────────────────

/** Pasa el proyecto de público a reservado y viceversa. */
export async function alternarVisibilidad(fd: FormData) {
  const user = await requireUser();
  const p = await proyectoVisible(user, Number(str(fd, "proyecto_id")));
  if (!p) redirect("/");
  if (!isBoss(mando(p, p.actual), user)) volver(p.id, "Solo el superior cambia la visibilidad");
  const publico = !p.publico;
  await prisma.proyecto.update({ where: { id: p.id }, data: { publico } });
  await anotar({
    user_id: user.id,
    accion: publico ? "PROYECTO_PUBLICO" : "PROYECTO_RESERVADO",
    detalle: publico ? "Visible para toda la unidad" : "Visible solo para superiores",
    proyecto_id: p.id,
  });
  volver(p.id);
}

export async function fijarEtapa(fd: FormData) {
  const { user, p, e } = await etapaDe(
    (await requireUser()).id,
    Number(str(fd, "proyecto_id")),
    Number(str(fd, "etapa_id")),
  );
  if (!isBoss(mando(p, e), user)) volver(p.id, "Solo el superior fija plazos y responsables");
  const fecha_fin = fecha(fd, "fecha_fin");
  if (fecha_fin && e.fecha_inicio && fecha_fin < e.fecha_inicio)
    volver(p.id, "El plazo no puede ser anterior al inicio de la etapa");
  const responsable_id = num(fd, "responsable_id");
  await prisma.etapa.update({ where: { id: e.id }, data: { fecha_fin, responsable_id } });
  const quien = responsable_id
    ? (await prisma.user.findUnique({ where: { id: responsable_id } }))?.name
    : null;
  await anotar({
    user_id: user.id,
    accion: "ETAPA_AJUSTADA",
    detalle: [
      quien ? `responsable ${quien}` : "sin responsable",
      fecha_fin ? `plazo ${fecha_fin.toLocaleDateString("es")}` : "sin plazo",
    ].join(" · "),
    proyecto_id: p.id,
    etapa_id: e.id,
  });
  volver(p.id);
}

export async function solicitarCierre(fd: FormData) {
  const { user, p, e } = await etapaDe(
    (await requireUser()).id,
    Number(str(fd, "proyecto_id")),
    Number(str(fd, "etapa_id")),
  );
  const actividades = await prisma.actividad.findMany({ where: { etapa_id: e.id } });
  const err = solicitarError(mando(p, e), user, cumplimiento(actividades));
  if (err) volver(p.id, err);
  await prisma.etapa.update({ where: { id: e.id }, data: { situacion: "SOLICITADA" } });
  await anotar({
    user_id: user.id,
    accion: "ETAPA_SOLICITADA",
    detalle: str(fd, "nota") || null,
    proyecto_id: p.id,
    etapa_id: e.id,
  });
  volver(p.id);
}

export async function resolverCierre(fd: FormData) {
  const { user, p, e } = await etapaDe(
    (await requireUser()).id,
    Number(str(fd, "proyecto_id")),
    Number(str(fd, "etapa_id")),
  );
  const err = resolverError(mando(p, e), user);
  if (err) volver(p.id, err);
  const nota = str(fd, "nota") || null;

  if (str(fd, "decision") === "devolver") {
    await prisma.etapa.update({ where: { id: e.id }, data: { situacion: "EN_CURSO" } });
    await anotar({
      user_id: user.id,
      accion: "ETAPA_DEVUELTA",
      detalle: nota,
      proyecto_id: p.id,
      etapa_id: e.id,
    });
    volver(p.id);
  }

  const siguiente = nextState(e.estado);
  const destino = siguiente ? p.etapas.find((x) => x.estado === siguiente) : undefined;
  await prisma.$transaction([
    prisma.etapa.update({
      where: { id: e.id },
      data: { situacion: "CERRADA", fecha_cierre: new Date() },
    }),
    ...(destino
      ? [
          prisma.etapa.update({
            where: { id: destino.id },
            data: {
              situacion: "EN_CURSO",
              fecha_inicio: new Date(),
              responsable_id: destino.responsable_id ?? e.responsable_id,
            },
          }),
        ]
      : []),
  ]);
  await anotar({
    user_id: user.id,
    accion: "ETAPA_APROBADA",
    detalle: nota,
    proyecto_id: p.id,
    etapa_id: e.id,
  });
  if (destino)
    await anotar({
      user_id: user.id,
      accion: "ETAPA_INICIADA",
      detalle: `Arranca ${destino.estado}`,
      proyecto_id: p.id,
      etapa_id: destino.id,
    });
  volver(p.id);
}

// ── actividades ───────────────────────────────────────────────────────────

export async function nuevaActividad(fd: FormData) {
  const { user, p, e } = await etapaDe(
    (await requireUser()).id,
    Number(str(fd, "proyecto_id")),
    Number(str(fd, "etapa_id")),
  );
  if (!canWrite(user)) volver(p.id, "Los observadores solo pueden consultar");
  if (!esParteDelProyecto(pertenencia(p), mando(p, e), user))
    volver(p.id, "No eres parte de este proyecto");
  if (e.situacion === "CERRADA") volver(p.id, "La etapa ya está cerrada");
  const nombre = str(fd, "nombre");
  const inicio = fecha(fd, "fecha_inicio");
  if (!nombre || !inicio) volver(p.id, "La actividad necesita nombre y fecha de inicio");
  const fin = fecha(fd, "fecha_fin");
  const err = rangoError(e, inicio!, fin);
  if (err) volver(p.id, err);
  const cadencia = str(fd, "cadencia");
  if (!["HORARIA", "DIARIA", "SEMANAL"].includes(cadencia))
    volver(p.id, "Elige cada cuánto se reporta el avance");
  const a = await prisma.actividad.create({
    data: {
      etapa_id: e.id,
      nombre,
      detalle: str(fd, "detalle") || null,
      fecha_inicio: inicio!,
      fecha_fin: fin,
      cadencia: cadencia as Cadencia,
      created_by: user.id,
    },
  });
  await anotar({
    user_id: user.id,
    accion: "ACTIVIDAD_CREADA",
    detalle: nombre,
    proyecto_id: p.id,
    etapa_id: e.id,
    actividad_id: a.id,
  });
  volver(p.id);
}

/** Registra un avance de una actividad abierta, dentro de su programación. */
export async function registrarAvance(fd: FormData) {
  const { user, p, e } = await etapaDe(
    (await requireUser()).id,
    Number(str(fd, "proyecto_id")),
    Number(str(fd, "etapa_id")),
  );
  if (!canWrite(user)) volver(p.id, "Los observadores solo pueden consultar");
  if (!esParteDelProyecto(pertenencia(p), mando(p, e), user))
    volver(p.id, "No eres parte de este proyecto");
  const a = await prisma.actividad.findFirst({
    where: { id: Number(str(fd, "actividad_id")), etapa_id: e.id },
  });
  if (!a) volver(p.id, "Esa actividad no existe");
  const cuando = momento(fd, "fecha") ?? new Date();
  const porcentaje = Number(str(fd, "porcentaje"));
  const err = avanceError(a!, cuando, porcentaje);
  if (err) volver(p.id, err);
  await prisma.avance.create({
    data: {
      actividad_id: a!.id,
      fecha: cuando,
      porcentaje,
      nota: str(fd, "nota") || null,
      user_id: user.id,
    },
  });
  await anotar({
    user_id: user.id,
    accion: "AVANCE_REGISTRADO",
    detalle: `${a!.nombre} · ${porcentaje}%${str(fd, "nota") ? ` · ${str(fd, "nota")}` : ""}`,
    proyecto_id: p.id,
    etapa_id: e.id,
    actividad_id: a!.id,
  });
  volver(p.id);
}

export async function visarActividad(fd: FormData) {
  const { user, p, e } = await etapaDe(
    (await requireUser()).id,
    Number(str(fd, "proyecto_id")),
    Number(str(fd, "etapa_id")),
  );
  const err = vistoBuenoError(mando(p, e), user);
  if (err) volver(p.id, err);
  const a = await prisma.actividad.findFirst({
    where: { id: Number(str(fd, "actividad_id")), etapa_id: e.id },
  });
  if (!a) volver(p.id, "Esa actividad no existe");
  const quitar = a!.aprobada_at !== null;
  await prisma.actividad.update({
    where: { id: a!.id },
    data: {
      aprobada_at: quitar ? null : new Date(),
      aprobada_por: quitar ? null : user.id,
    },
  });
  await anotar({
    user_id: user.id,
    accion: quitar ? "ACTIVIDAD_VOBO_RETIRADO" : "ACTIVIDAD_VOBO",
    detalle: a!.nombre,
    proyecto_id: p.id,
    etapa_id: e.id,
    actividad_id: a!.id,
  });
  volver(p.id);
}

// ── administración ────────────────────────────────────────────────────────

export async function createUser(fd: FormData) {
  const user = await requireUser();
  if (user.role !== "SA" && user.role !== "SUP") redirect("/");
  const name = str(fd, "name");
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  const role = str(fd, "role");
  if (!name || !email || password.length < 6) redirect("/personas?e=datos-incompletos");
  if (!isRole(role)) redirect("/personas?e=rol-invalido");

  // El superior solo da de alta dependientes, y siempre dentro de su unidad.
  const { unidad } = await unidadActiva(user);
  let unidad_id = num(fd, "unidad_id");
  if (user.role === "SUP") {
    if (role !== "DEP") redirect("/personas?e=solo-dependientes");
    if (!unidad) redirect("/personas?e=sin-unidad");
    unidad_id = unidad!.id;
  } else if (unidad_id !== null && !(await perteneceA(user, unidad_id))) {
    redirect("/personas?e=unidad");
  }
  if (await prisma.user.findUnique({ where: { email } })) redirect("/personas?e=correo-duplicado");

  const nuevo = await prisma.user.create({
    data: {
      name,
      email,
      password: hashPassword(password),
      role,
      manager_id: user.role === "SUP" ? user.id : num(fd, "manager_id"),
      unidad_activa_id: unidad_id,
    },
  });
  if (unidad_id) await prisma.usuarioUnidad.create({ data: { user_id: nuevo.id, unidad_id } });
  await anotar({
    user_id: user.id,
    accion: "PERSONA_CREADA",
    detalle: `${name} (${role})${unidad_id ? "" : " · sin unidad"}`,
  });
  revalidatePath("/personas");
}

export async function crearUnidad(fd: FormData) {
  const user = await requireUser();
  if (user.role !== "SA") redirect("/");
  const nombre = str(fd, "nombre");
  if (!nombre) redirect("/unidades?e=Escribe un nombre");
  if (await prisma.unidad.findUnique({ where: { nombre } }))
    redirect("/unidades?e=Ya existe una unidad con ese nombre");
  const u = await prisma.unidad.create({ data: { nombre } });
  await anotar({ user_id: user.id, accion: "UNIDAD_CREADA", detalle: u.nombre });
  revalidatePath("/unidades");
}

/** Cambia el nombre de una unidad. Solo el Super Administrador. */
export async function renombrarUnidad(fd: FormData) {
  const user = await requireUser();
  if (user.role !== "SA") redirect("/");
  const id = Number(str(fd, "unidad_id"));
  const nombre = str(fd, "nombre");
  const actual = await prisma.unidad.findUnique({ where: { id } });
  if (!actual) redirect("/unidades?e=Esa unidad ya no existe");
  if (!nombre) redirect("/unidades?e=El nombre no puede quedar vacío");
  if (nombre === actual!.nombre) redirect("/unidades");
  const repetida = await prisma.unidad.findUnique({ where: { nombre } });
  if (repetida) redirect("/unidades?e=Ya existe una unidad con ese nombre");
  await prisma.unidad.update({ where: { id }, data: { nombre } });
  await anotar({
    user_id: user.id,
    accion: "UNIDAD_RENOMBRADA",
    detalle: `${actual!.nombre} → ${nombre}`,
  });
  redirect("/unidades");
}

/** Marca o desmarca la pertenencia de una persona a una unidad. */
export async function alternarMiembro(fd: FormData) {
  const user = await requireUser();
  if (user.role !== "SA" && user.role !== "SUP") redirect("/");
  const user_id = Number(str(fd, "user_id"));
  const unidad_id = Number(str(fd, "unidad_id"));
  // El superior solo mueve gente dentro de las unidades a las que pertenece.
  if (!(await perteneceA(user, unidad_id))) redirect("/unidades?e=Solo puedes mover gente en tu unidad");
  const clave = { user_id_unidad_id: { user_id, unidad_id } };
  const existe = await prisma.usuarioUnidad.findUnique({ where: clave });
  if (existe) await prisma.usuarioUnidad.delete({ where: clave });
  else await prisma.usuarioUnidad.create({ data: { user_id, unidad_id } });
  const [quien, donde] = await Promise.all([
    prisma.user.findUnique({ where: { id: user_id } }),
    prisma.unidad.findUnique({ where: { id: unidad_id } }),
  ]);
  await anotar({
    user_id: user.id,
    accion: existe ? "UNIDAD_BAJA" : "UNIDAD_ALTA",
    detalle: `${quien?.name} · ${donde?.nombre}`,
  });
  revalidatePath("/unidades");
}
