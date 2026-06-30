-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- AlterTable
ALTER TABLE "LineItem" ADD COLUMN     "quoteId" TEXT;

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "quote_number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "pdf_url" TEXT,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteFile" (
    "id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "pdf_upload_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Quote_userId_idx" ON "Quote"("userId");

-- CreateIndex
CREATE INDEX "Quote_quote_number_idx" ON "Quote"("quote_number");

-- CreateIndex
CREATE INDEX "Quote_userId_is_deleted_created_at_idx" ON "Quote"("userId", "is_deleted", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Quote_userId_quote_number_key" ON "Quote"("userId", "quote_number");

-- CreateIndex
CREATE INDEX "QuoteFile_quote_id_idx" ON "QuoteFile"("quote_id");

-- CreateIndex
CREATE INDEX "QuoteFile_pdf_upload_id_idx" ON "QuoteFile"("pdf_upload_id");

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteFile" ADD CONSTRAINT "QuoteFile_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteFile" ADD CONSTRAINT "QuoteFile_pdf_upload_id_fkey" FOREIGN KEY ("pdf_upload_id") REFERENCES "PdfUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineItem" ADD CONSTRAINT "LineItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
