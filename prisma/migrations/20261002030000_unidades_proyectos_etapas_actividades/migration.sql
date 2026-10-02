-- CreateEnum
CREATE TYPE "Situacion" AS ENUM ('PENDIENTE', 'EN_CURSO', 'SOLICITADA', 'CERRADA');

-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('SYSTEM', 'LIGHT', 'DARK');

-- DropForeignKey
ALTER TABLE "History" DROP CONSTRAINT "History_task_id_fkey";

-- DropForeignKey
ALTER TABLE "History" DROP CONSTRAINT "History_user_id_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_assignee_id_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_created_by_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "theme" "Theme" NOT NULL DEFAULT 'SYSTEM';

-- CreateTable
CREATE TABLE "Unidad" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Unidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuarioUnidad" (
    "user_id" INTEGER NOT NULL,
    "unidad_id" INTEGER NOT NULL,

    CONSTRAINT "UsuarioUnidad_pkey" PRIMARY KEY ("user_id","unidad_id")
);

-- CreateTable
CREATE TABLE "Proyecto" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "detalle" TEXT,
    "unidad_id" INTEGER NOT NULL,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Proyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Etapa" (
    "id" SERIAL NOT NULL,
    "proyecto_id" INTEGER NOT NULL,
    "estado" "State" NOT NULL,
    "situacion" "Situacion" NOT NULL DEFAULT 'PENDIENTE',
    "fecha_inicio" TIMESTAMP(3),
    "fecha_fin" TIMESTAMP(3),
    "fecha_cierre" TIMESTAMP(3),
    "responsable_id" INTEGER,

    CONSTRAINT "Etapa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Actividad" (
    "id" SERIAL NOT NULL,
    "etapa_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "detalle" TEXT,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_fin" TIMESTAMP(3),
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aprobada_at" TIMESTAMP(3),
    "aprobada_por" INTEGER,

    CONSTRAINT "Actividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bitacora" (
    "id" SERIAL NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" INTEGER NOT NULL,
    "accion" TEXT NOT NULL,
    "detalle" TEXT,
    "proyecto_id" INTEGER,
    "etapa_id" INTEGER,
    "actividad_id" INTEGER,

    CONSTRAINT "Bitacora_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Unidad_nombre_key" ON "Unidad"("nombre");

-- CreateIndex
CREATE INDEX "Proyecto_unidad_id_idx" ON "Proyecto"("unidad_id");

-- CreateIndex
CREATE INDEX "Etapa_situacion_idx" ON "Etapa"("situacion");

-- CreateIndex
CREATE UNIQUE INDEX "Etapa_proyecto_id_estado_key" ON "Etapa"("proyecto_id", "estado");

-- CreateIndex
CREATE INDEX "Actividad_etapa_id_idx" ON "Actividad"("etapa_id");

-- CreateIndex
CREATE INDEX "Bitacora_proyecto_id_idx" ON "Bitacora"("proyecto_id");

-- AddForeignKey
ALTER TABLE "UsuarioUnidad" ADD CONSTRAINT "UsuarioUnidad_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioUnidad" ADD CONSTRAINT "UsuarioUnidad_unidad_id_fkey" FOREIGN KEY ("unidad_id") REFERENCES "Unidad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proyecto" ADD CONSTRAINT "Proyecto_unidad_id_fkey" FOREIGN KEY ("unidad_id") REFERENCES "Unidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proyecto" ADD CONSTRAINT "Proyecto_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Etapa" ADD CONSTRAINT "Etapa_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Etapa" ADD CONSTRAINT "Etapa_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_etapa_id_fkey" FOREIGN KEY ("etapa_id") REFERENCES "Etapa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_aprobada_por_fkey" FOREIGN KEY ("aprobada_por") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bitacora" ADD CONSTRAINT "Bitacora_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bitacora" ADD CONSTRAINT "Bitacora_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bitacora" ADD CONSTRAINT "Bitacora_etapa_id_fkey" FOREIGN KEY ("etapa_id") REFERENCES "Etapa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bitacora" ADD CONSTRAINT "Bitacora_actividad_id_fkey" FOREIGN KEY ("actividad_id") REFERENCES "Actividad"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────────────────
-- Traspaso de datos: cada Task se convierte en un Proyecto con sus 8 Etapas.
-- ─────────────────────────────────────────────────────────────────────────
DO $migracion$
DECLARE
  unidad_general INT;
  t              RECORD;
  h              RECORD;
  nuevo_proyecto INT;
  etapa_actual   INT;
  etapa_destino  INT;
  v_estado       "State";
  pos_estado     INT;
  pos_actual     INT;
  estados        "State"[] := ARRAY['PROPUESTA','APROBACION','ANALISIS','ASIGNACION',
                                    'DESARROLLO','TEST','VOBO','PRODUCCION']::"State"[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Task") THEN RETURN; END IF;

  INSERT INTO "Unidad" (nombre) VALUES ('General') RETURNING id INTO unidad_general;
  INSERT INTO "UsuarioUnidad" (user_id, unidad_id) SELECT id, unidad_general FROM "User";

  FOR t IN SELECT * FROM "Task" ORDER BY id LOOP
    INSERT INTO "Proyecto" (nombre, detalle, unidad_id, created_by, created_at)
    VALUES (t.title, t.description, unidad_general, t.created_by, t.created_at)
    RETURNING id INTO nuevo_proyecto;

    pos_actual := array_position(estados, t.status);

    FOREACH v_estado IN ARRAY estados LOOP
      pos_estado := array_position(estados, v_estado);
      INSERT INTO "Etapa" (proyecto_id, estado, situacion, fecha_inicio, fecha_cierre, responsable_id)
      VALUES (
        nuevo_proyecto,
        v_estado,
        CASE WHEN pos_estado <  pos_actual THEN 'CERRADA'::"Situacion"
             WHEN pos_estado =  pos_actual THEN 'EN_CURSO'::"Situacion"
             ELSE 'PENDIENTE'::"Situacion" END,
        CASE WHEN pos_estado <= pos_actual THEN t.created_at ELSE NULL END,
        CASE WHEN pos_estado <  pos_actual THEN t.created_at ELSE NULL END,
        CASE WHEN pos_estado =  pos_actual THEN t.assignee_id ELSE NULL END
      );
    END LOOP;

    SELECT id INTO etapa_actual FROM "Etapa" WHERE proyecto_id = nuevo_proyecto AND "Etapa".estado = t.status;

    INSERT INTO "Bitacora" (at, user_id, accion, detalle, proyecto_id, etapa_id)
    VALUES (t.created_at, t.created_by, 'PROYECTO_CREADO', 'Migrado desde el modelo anterior.',
            nuevo_proyecto, etapa_actual);

    FOR h IN SELECT * FROM "History" WHERE task_id = t.id ORDER BY id LOOP
      SELECT id INTO etapa_destino FROM "Etapa"
       WHERE proyecto_id = nuevo_proyecto AND "Etapa".estado = COALESCE(h.to_status, t.status);
      INSERT INTO "Bitacora" (at, user_id, accion, detalle, proyecto_id, etapa_id)
      VALUES (h.at, h.user_id,
              CASE WHEN h.to_status IS NOT NULL THEN 'ETAPA_INICIADA' ELSE 'ETAPA_RESPONSABLE' END,
              h.note, nuevo_proyecto, etapa_destino);
    END LOOP;
  END LOOP;
END
$migracion$;

-- Recién ahora, con los datos ya copiados, se van las tablas del modelo anterior.
DROP TABLE "History";
DROP TABLE "Task";
