/*
  Warnings:

  - You are about to drop the column `quoteId` on the `LineItem` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "LineItem" DROP CONSTRAINT "LineItem_quoteId_fkey";

-- AlterTable
ALTER TABLE "LineItem" DROP COLUMN "quoteId",
ADD COLUMN     "quote_file_id" TEXT,
ADD COLUMN     "quote_id" TEXT;

-- CreateIndex
CREATE INDEX "LineItem_quote_id_idx" ON "LineItem"("quote_id");

-- CreateIndex
CREATE INDEX "LineItem_quote_id_isDeleted_idx" ON "LineItem"("quote_id", "isDeleted");

-- AddForeignKey
ALTER TABLE "LineItem" ADD CONSTRAINT "LineItem_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineItem" ADD CONSTRAINT "LineItem_quote_file_id_fkey" FOREIGN KEY ("quote_file_id") REFERENCES "QuoteFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
