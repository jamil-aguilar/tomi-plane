-- AlterTable
ALTER TABLE "Proyecto" ADD COLUMN     "publico" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "unidad_activa_id" INTEGER;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_unidad_activa_id_fkey" FOREIGN KEY ("unidad_activa_id") REFERENCES "Unidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;
