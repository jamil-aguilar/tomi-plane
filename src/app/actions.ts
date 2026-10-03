"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomBytes, createHash } from "node:crypto";
import { unlink } from "node:fs/promises";
import { clearSession, requireUser, setSession } from "@/lib/auth";
import { guardarPdf, rutaDe } from "@/lib/archivos";
import { ES_HEX, recorta } from "@/lib/apariencia";
import { correoDeRecuperacion, enviar } from "@/lib/correo";
import {
  anotar,
  buscarPorUsuario,
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
  editarActividadError,
  editarAvanceError,
  esParteDelProyecto,
  finalizarError,
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

const volver = (id: number, e?: string, etapa?: number) => {
  const q = new URLSearchParams();
  if (etapa) q.set("etapa", String(etapa));
  if (e) q.set("e", e);
  const cola = q.toString();
  redirect(`/proyectos/${id}${cola ? `?${cola}` : ""}`);
};

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
  // Acepta el correo completo o solo el usuario: jamil o jamil@local.
  const u = await buscarPorUsuario(str(fd, "email"));
  if (!u || !verifyPassword(str(fd, "password"), u.password)) redirect("/login?e=1");
  await setSession(u.id);
  redirect("/");
}

const MINUTOS_RESET = 30;

/** Siempre responde igual, haya o no cuenta: no delata qué correos existen. */
export async function pedirRecuperacion(fd: FormData) {
  const u = await buscarPorUsuario(str(fd, "email"));
  if (u) {
    const token = randomBytes(32).toString("base64url");
    await prisma.passwordReset.create({
      data: {
        user_id: u.id,
        token_hash: createHash("sha256").update(token).digest("hex"),
        expira: new Date(Date.now() + MINUTOS_RESET * 60_000),
      },
    });
    const base = process.env.APP_URL ?? "http://localhost:3000";
    const { texto, html } = correoDeRecuperacion(u.name, `${base}/restablecer/${token}`, MINUTOS_RESET);
    try {
      await enviar(u.email, "Restablecer tu contraseña de TOMY", texto, html);
    } catch {
      redirect("/olvide?e=No se pudo enviar el correo. Avisa al administrador.");
    }
  }
  redirect("/olvide?ok=1");
}

export async function restablecer(fd: FormData) {
  const token = str(fd, "token");
  const clave = str(fd, "password");
  const volverAlForm = (m: string) => redirect(`/restablecer/${token}?e=${encodeURIComponent(m)}`);
  if (clave.length < 6) volverAlForm("La contraseña necesita al menos 6 caracteres");
  if (clave !== str(fd, "password2")) volverAlForm("Las dos contraseñas no coinciden");

  const pedido = await prisma.passwordReset.findUnique({
    where: { token_hash: createHash("sha256").update(token).digest("hex") },
  });
  if (!pedido || pedido.usado_at || pedido.expira < new Date())
    redirect("/olvide?e=Ese enlace ya venció o fue usado. Pide uno nuevo.");

  await prisma.$transaction([
    prisma.user.update({ where: { id: pedido!.user_id }, data: { password: hashPassword(clave) } }),
    prisma.passwordReset.update({ where: { id: pedido!.id }, data: { usado_at: new Date() } }),
    // Cualquier otro pedido abierto deja de servir.
    prisma.passwordReset.updateMany({
      where: { user_id: pedido!.user_id, usado_at: null },
      data: { usado_at: new Date() },
    }),
  ]);
  await anotar({ user_id: pedido!.user_id, accion: "CONTRASENA_RESTABLECIDA" });
  redirect("/login?ok=1");
}

export async function logout() {
  await clearSession();
  redirect("/login");
}

/** Tema y color de marca. Todo opcional: sin color, manda el de la aplicación. */
export async function guardarApariencia(fd: FormData) {
  const user = await requireUser();
  const theme = str(fd, "theme");
  const data: { theme?: Theme; color?: string | null; color_intensidad?: number; color_alpha?: number } =
    {};
  if (THEMES.includes(theme as Theme)) data.theme = theme as Theme;

  if (str(fd, "restablecer") === "si") {
    data.color = null;
    data.color_intensidad = 100;
    data.color_alpha = 100;
  } else {
    // La rueda solo manda si la movieron; si no, vale la muestra que marcaron.
    const rueda = str(fd, "color").toLowerCase();
    const muestra = str(fd, "sugerido").toLowerCase();
    const anterior = (user.color ?? "#5b2ee5").toLowerCase();
    const hex = rueda && rueda !== anterior ? rueda : muestra || rueda;
    if (hex && !ES_HEX.test(hex)) redirect("/apariencia");
    if (hex) data.color = hex;
    data.color_intensidad = recorta(Number(str(fd, "intensidad")));
    data.color_alpha = recorta(Number(str(fd, "alpha")));
  }

  await prisma.user.update({ where: { id: user.id }, data });
  revalidatePath("/", "layout");
  redirect("/apariencia?ok=1");
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
  volver(p.id, undefined, e.id);
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
  volver(p.id, undefined, e.id);
}

/** Busca la actividad y comprueba de una vez quién puede tocarla. */
async function actividadDe(fd: FormData, regla: "editar" | "finalizar") {
  const { user, p, e } = await etapaDe(
    (await requireUser()).id,
    Number(str(fd, "proyecto_id")),
    Number(str(fd, "etapa_id")),
  );
  const a = await prisma.actividad.findFirst({
    where: { id: Number(str(fd, "actividad_id")), etapa_id: e.id },
  });
  if (!a) volver(p.id, "Esa actividad no existe");
  if (!esParteDelProyecto(pertenencia(p), mando(p, e), user))
    volver(p.id, "No eres parte de este proyecto");
  const err =
    regla === "editar"
      ? editarActividadError(mando(p, e), a!, user)
      : finalizarError(mando(p, e), a!, user);
  if (err) volver(p.id, err);
  return { user, p, e, a: a! };
}

export async function editarActividad(fd: FormData) {
  const { user, p, e, a } = await actividadDe(fd, "editar");
  const nombre = str(fd, "nombre");
  const inicio = fecha(fd, "fecha_inicio");
  if (!nombre || !inicio) volver(p.id, "La actividad necesita nombre y fecha de inicio");
  const fin = fecha(fd, "fecha_fin");
  const err = rangoError(e, inicio!, fin);
  if (err) volver(p.id, err);
  const cadencia = str(fd, "cadencia");
  if (!["HORARIA", "DIARIA", "SEMANAL"].includes(cadencia))
    volver(p.id, "Elige cada cuánto se reporta el avance");
  await prisma.actividad.update({
    where: { id: a.id },
    data: {
      nombre,
      detalle: str(fd, "detalle") || null,
      fecha_inicio: inicio!,
      fecha_fin: fin,
      cadencia: cadencia as Cadencia,
    },
  });
  await anotar({
    user_id: user.id,
    accion: "ACTIVIDAD_EDITADA",
    detalle: a.nombre === nombre ? nombre : `${a.nombre} → ${nombre}`,
    proyecto_id: p.id,
    etapa_id: e.id,
    actividad_id: a.id,
  });
  volver(p.id, undefined, e.id);
}

export async function eliminarActividad(fd: FormData) {
  const { user, p, e, a } = await actividadDe(fd, "editar");
  // Los PDF en disco no los borra la base: hay que sacarlos a mano.
  const docs = await prisma.documento.findMany({ where: { actividad_id: a.id } });
  await prisma.actividad.delete({ where: { id: a.id } });
  for (const d of docs) await unlink(rutaDe(d.archivo)).catch(() => {});
  await anotar({
    user_id: user.id,
    accion: "ACTIVIDAD_ELIMINADA",
    detalle: a.nombre,
    proyecto_id: p.id,
    etapa_id: e.id,
  });
  volver(p.id, undefined, e.id);
}

/** El responsable la da por terminada, o deshace si se apuró. */
export async function finalizarActividad(fd: FormData) {
  const { user, p, e, a } = await actividadDe(fd, "finalizar");
  const terminada = a.finalizada_at === null;
  await prisma.actividad.update({
    where: { id: a.id },
    data: { finalizada_at: terminada ? new Date() : null },
  });
  await anotar({
    user_id: user.id,
    accion: terminada ? "ACTIVIDAD_FINALIZADA" : "ACTIVIDAD_REABIERTA",
    detalle: a.nombre,
    proyecto_id: p.id,
    etapa_id: e.id,
    actividad_id: a.id,
  });
  volver(p.id, undefined, e.id);
}

/** Busca un avance y comprueba quién puede corregirlo. */
async function avanceDe(fd: FormData) {
  const { user, p, e } = await etapaDe(
    (await requireUser()).id,
    Number(str(fd, "proyecto_id")),
    Number(str(fd, "etapa_id")),
  );
  const avance = await prisma.avance.findFirst({
    where: { id: Number(str(fd, "avance_id")), actividad: { etapa_id: e.id } },
    include: { actividad: true },
  });
  if (!avance) volver(p.id, "Ese avance ya no existe", e.id);
  if (!esParteDelProyecto(pertenencia(p), mando(p, e), user))
    volver(p.id, "No eres parte de este proyecto", e.id);
  const err = editarAvanceError(mando(p, e), avance!.actividad, avance!, user);
  if (err) volver(p.id, err, e.id);
  return { user, p, e, avance: avance! };
}

export async function editarAvance(fd: FormData) {
  const { user, p, e, avance } = await avanceDe(fd);
  const cuando = momento(fd, "fecha") ?? avance.fecha;
  const porcentaje = Number(str(fd, "porcentaje"));
  const err = avanceError(avance.actividad, cuando, porcentaje);
  if (err) volver(p.id, err, e.id);
  await prisma.avance.update({
    where: { id: avance.id },
    data: { fecha: cuando, porcentaje, nota: str(fd, "nota") || null },
  });
  await anotar({
    user_id: user.id,
    accion: "AVANCE_CORREGIDO",
    detalle: `${avance.actividad.nombre} · ${avance.porcentaje}% → ${porcentaje}%`,
    proyecto_id: p.id,
    etapa_id: e.id,
    actividad_id: avance.actividad_id,
  });
  volver(p.id, undefined, e.id);
}

export async function eliminarAvance(fd: FormData) {
  const { user, p, e, avance } = await avanceDe(fd);
  await prisma.avance.delete({ where: { id: avance.id } });
  await anotar({
    user_id: user.id,
    accion: "AVANCE_ELIMINADO",
    detalle: `${avance.actividad.nombre} · ${avance.porcentaje}%`,
    proyecto_id: p.id,
    etapa_id: e.id,
    actividad_id: avance.actividad_id,
  });
  volver(p.id, undefined, e.id);
}

/** Adjunta un PDF a una actividad. Opcional. */
export async function subirDocumento(fd: FormData) {
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

  const file = fd.get("archivo");
  if (!(file instanceof File) || file.size === 0) volver(p.id, "Elige un PDF para adjuntar");
  const guardado = await guardarPdf(file as File);
  if ("error" in guardado) volver(p.id, guardado.error);
  const ok = guardado as { archivo: string; bytes: number; nombre: string };

  const doc = await prisma.documento.create({
    data: {
      actividad_id: a!.id,
      nombre: ok.nombre,
      archivo: ok.archivo,
      bytes: ok.bytes,
      subido_por: user.id,
    },
  });
  await anotar({
    user_id: user.id,
    accion: "DOCUMENTO_ADJUNTADO",
    detalle: `${a!.nombre} · ${ok.nombre}`,
    proyecto_id: p.id,
    etapa_id: e.id,
    actividad_id: a!.id,
  });
  revalidatePath(`/proyectos/${p.id}`);
  void doc;
  volver(p.id, undefined, e.id);
}

export async function borrarDocumento(fd: FormData) {
  const { user, p, e } = await etapaDe(
    (await requireUser()).id,
    Number(str(fd, "proyecto_id")),
    Number(str(fd, "etapa_id")),
  );
  const doc = await prisma.documento.findFirst({
    where: { id: Number(str(fd, "documento_id")), actividad: { etapa_id: e.id } },
  });
  if (!doc) volver(p.id, "Ese documento ya no existe");
  // Lo quita quien lo subió, o el superior de la etapa.
  if (doc!.subido_por !== user.id && !isBoss(mando(p, e), user))
    volver(p.id, "Solo quien lo subió o el superior puede quitarlo");
  await prisma.documento.delete({ where: { id: doc!.id } });
  await unlink(rutaDe(doc!.archivo)).catch(() => {});
  await anotar({
    user_id: user.id,
    accion: "DOCUMENTO_QUITADO",
    detalle: doc!.nombre,
    proyecto_id: p.id,
    etapa_id: e.id,
  });
  volver(p.id, undefined, e.id);
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
  volver(p.id, undefined, e.id);
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
