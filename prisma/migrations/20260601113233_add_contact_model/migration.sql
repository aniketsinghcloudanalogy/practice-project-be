/*
  Warnings:

  - You are about to drop the column `phone` on the `Contact` table. All the data in the column will be lost.
  - Added the required column `email` to the `Contact` table without a default value. This is not possible if the table is not empty.
  - Added the required column `firstName` to the `Contact` table without a default value. This is not possible if the table is not empty.
  - Added the required column `primaryContact` to the `Contact` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Contact" DROP CONSTRAINT "Contact_userId_fkey";

-- AlterTable
ALTER TABLE "Contact" DROP COLUMN "phone",
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "firstName" TEXT NOT NULL,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "primaryContact" TEXT NOT NULL,
ADD COLUMN     "secondaryContact" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Contact_email_idx" ON "Contact"("email");

-- CreateIndex
CREATE INDEX "Contact_createdAt_idx" ON "Contact"("createdAt");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
