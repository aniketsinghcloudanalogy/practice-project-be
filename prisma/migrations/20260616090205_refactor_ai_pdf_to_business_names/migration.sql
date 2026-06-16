/*
  Warnings:

  - You are about to drop the `AiExtractedRow` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AiExtractedTable` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AiExtractedRow" DROP CONSTRAINT "AiExtractedRow_aiExtractedTableId_fkey";

-- DropForeignKey
ALTER TABLE "AiExtractedTable" DROP CONSTRAINT "AiExtractedTable_userId_fkey";

-- DropTable
DROP TABLE "AiExtractedRow";

-- DropTable
DROP TABLE "AiExtractedTable";

-- CreateTable
CREATE TABLE "PdfUpload" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdfUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdfTable" (
    "id" TEXT NOT NULL,
    "pdfUploadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "columns" JSONB NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdfTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdfTableRow" (
    "id" TEXT NOT NULL,
    "pdfTableId" TEXT NOT NULL,
    "rowData" JSONB NOT NULL,
    "rowIndex" INTEGER,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdfTableRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PdfUpload_userId_idx" ON "PdfUpload"("userId");

-- CreateIndex
CREATE INDEX "PdfUpload_isDeleted_idx" ON "PdfUpload"("isDeleted");

-- CreateIndex
CREATE INDEX "PdfTable_pdfUploadId_idx" ON "PdfTable"("pdfUploadId");

-- CreateIndex
CREATE INDEX "PdfTable_userId_idx" ON "PdfTable"("userId");

-- CreateIndex
CREATE INDEX "PdfTable_isDeleted_idx" ON "PdfTable"("isDeleted");

-- CreateIndex
CREATE INDEX "PdfTableRow_pdfTableId_idx" ON "PdfTableRow"("pdfTableId");

-- CreateIndex
CREATE INDEX "PdfTableRow_isDeleted_idx" ON "PdfTableRow"("isDeleted");

-- AddForeignKey
ALTER TABLE "PdfUpload" ADD CONSTRAINT "PdfUpload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfTable" ADD CONSTRAINT "PdfTable_pdfUploadId_fkey" FOREIGN KEY ("pdfUploadId") REFERENCES "PdfUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfTable" ADD CONSTRAINT "PdfTable_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfTableRow" ADD CONSTRAINT "PdfTableRow_pdfTableId_fkey" FOREIGN KEY ("pdfTableId") REFERENCES "PdfTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
