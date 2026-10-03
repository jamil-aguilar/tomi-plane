-- AlterTable
ALTER TABLE "User" ADD COLUMN     "color" TEXT,
ADD COLUMN     "color_alpha" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "color_intensidad" INTEGER NOT NULL DEFAULT 100;
