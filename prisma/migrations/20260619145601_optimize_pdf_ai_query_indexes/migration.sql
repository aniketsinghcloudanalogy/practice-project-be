-- CreateIndex
CREATE INDEX "LineItem_pdfTableId_userId_isDeleted_idx" ON "LineItem"("pdfTableId", "userId", "isDeleted");

-- CreateIndex
CREATE INDEX "LineItem_userId_isDeleted_createdAt_idx" ON "LineItem"("userId", "isDeleted", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PdfTable_pdfUploadId_isDeleted_createdAt_idx" ON "PdfTable"("pdfUploadId", "isDeleted", "createdAt");

-- CreateIndex
CREATE INDEX "PdfTable_pdfUploadId_userId_isDeleted_idx" ON "PdfTable"("pdfUploadId", "userId", "isDeleted");

-- CreateIndex
CREATE INDEX "PdfTableRow_pdfTableId_isDeleted_rowIndex_idx" ON "PdfTableRow"("pdfTableId", "isDeleted", "rowIndex");

-- CreateIndex
CREATE INDEX "PdfUpload_userId_isDeleted_createdAt_idx" ON "PdfUpload"("userId", "isDeleted", "createdAt" DESC);
