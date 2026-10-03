import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const SUBCARPETA = "doc_actividades";
export const LIMITE_BYTES = 8 * 1024 * 1024;

/** Carpeta de documentos. Cambiar ARCHIVOS_DIR en .env mueve todo de lugar. */
export const carpeta = () => path.resolve(process.env.ARCHIVOS_DIR ?? "./file-tmp", SUBCARPETA);

export const rutaDe = (archivo: string) => path.join(carpeta(), path.basename(archivo));

/** Un PDF de verdad empieza con %PDF-. No alcanza con mirar el nombre. */
const esPdf = (b: Uint8Array) =>
  b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;

/** null en `error` = guardado. */
export async function guardarPdf(
  file: File,
): Promise<{ error: string } | { archivo: string; bytes: number; nombre: string }> {
  if (file.size === 0) return { error: "El archivo está vacío" };
  if (file.size > LIMITE_BYTES)
    return { error: `El archivo supera los ${LIMITE_BYTES / 1024 / 1024} MB` };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!esPdf(bytes)) return { error: "Solo se aceptan archivos PDF" };

  const archivo = `${Date.now().toString(36)}-${randomBytes(8).toString("hex")}.pdf`;
  await mkdir(carpeta(), { recursive: true });
  await writeFile(path.join(carpeta(), archivo), bytes);
  // El nombre original es dato de quien sube: se guarda, nunca se usa como ruta.
  const nombre = (file.name || "documento.pdf").slice(0, 160);
  return { archivo, bytes: file.size, nombre };
}
