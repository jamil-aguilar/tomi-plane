-- CreateEnum
CREATE TYPE "Cadencia" AS ENUM ('HORARIA', 'DIARIA', 'SEMANAL');

-- AlterTable
ALTER TABLE "Actividad" ADD COLUMN     "cadencia" "Cadencia" NOT NULL DEFAULT 'DIARIA';

-- CreateTable
CREATE TABLE "Avance" (
    "id" SERIAL NOT NULL,
    "actividad_id" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "porcentaje" INTEGER NOT NULL,
    "nota" TEXT,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Avance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Avance_actividad_id_idx" ON "Avance"("actividad_id");

-- AddForeignKey
ALTER TABLE "Avance" ADD CONSTRAINT "Avance_actividad_id_fkey" FOREIGN KEY ("actividad_id") REFERENCES "Actividad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avance" ADD CONSTRAINT "Avance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
