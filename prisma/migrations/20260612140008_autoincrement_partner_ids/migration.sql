/*
  Warnings:

  - The primary key for the `Partner` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Partner` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `PartnerProgram` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `PartnerProgram` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `partnerId` on the `PartnerProgram` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "PartnerProgram" DROP CONSTRAINT "PartnerProgram_partnerId_fkey";

-- AlterTable
ALTER TABLE "Partner" DROP CONSTRAINT "Partner_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Partner_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "PartnerProgram" DROP CONSTRAINT "PartnerProgram_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "partnerId",
ADD COLUMN     "partnerId" INTEGER NOT NULL,
ADD CONSTRAINT "PartnerProgram_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "PartnerProgram_partnerId_idx" ON "PartnerProgram"("partnerId");

-- AddForeignKey
ALTER TABLE "PartnerProgram" ADD CONSTRAINT "PartnerProgram_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
