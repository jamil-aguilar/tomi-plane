import { readFile } from "node:fs/promises";
import { currentUser } from "@/lib/auth";
import { esParteDelProyecto } from "@/lib/workflow";
import { mando, pertenencia, prisma, proyectoVisible } from "@/lib/db";
import { rutaDe } from "@/lib/archivos";

/** Descarga de un PDF. Lo sirve solo a quien puede ver las actividades. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new Response("No autorizado", { status: 401 });

  const { id } = await params;
  const doc = await prisma.documento.findUnique({
    where: { id: Number(id) },
    include: { actividad: { include: { etapa: true } } },
  });
  if (!doc) return new Response("No encontrado", { status: 404 });

  const p = await proyectoVisible(user, doc.actividad.etapa.proyecto_id);
  if (!p) return new Response("No encontrado", { status: 404 });
  const etapa = p.etapas.find((x) => x.id === doc.actividad.etapa_id);
  if (!etapa || !esParteDelProyecto(pertenencia(p), mando(p, etapa), user))
    return new Response("No encontrado", { status: 404 });

  const contenido = await readFile(rutaDe(doc.archivo)).catch(() => null);
  if (!contenido) return new Response("El archivo ya no está en disco", { status: 410 });

  return new Response(new Uint8Array(contenido), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.nombre)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
