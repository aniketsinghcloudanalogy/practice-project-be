-- CreateTable
CREATE TABLE "Profitabilty_line_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quote_id" TEXT,
    "quote_file_id" TEXT,
    "pdfTableId" TEXT NOT NULL,
    "sourceTableTitle" TEXT,
    "rowSourceId" TEXT,
    "rowIndex" INTEGER,
    "lineNumber" TEXT,
    "itemCode" TEXT,
    "employeeId" TEXT,
    "employeeName" TEXT,
    "description" TEXT,
    "department" TEXT,
    "category" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "salary" TEXT,
    "quantity" TEXT,
    "unitPrice" TEXT,
    "amount" TEXT,
    "currency" TEXT,
    "status" TEXT,
    "referenceNo" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "is_Verifed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profitabilty_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Profitabilty_line_items_userId_idx" ON "Profitabilty_line_items"("userId");

-- CreateIndex
CREATE INDEX "Profitabilty_line_items_quote_id_idx" ON "Profitabilty_line_items"("quote_id");

-- CreateIndex
CREATE INDEX "Profitabilty_line_items_pdfTableId_idx" ON "Profitabilty_line_items"("pdfTableId");

-- CreateIndex
CREATE INDEX "Profitabilty_line_items_isDeleted_idx" ON "Profitabilty_line_items"("isDeleted");

-- CreateIndex
CREATE INDEX "Profitabilty_line_items_pdfTableId_userId_isDeleted_idx" ON "Profitabilty_line_items"("pdfTableId", "userId", "isDeleted");

-- CreateIndex
CREATE INDEX "Profitabilty_line_items_quote_id_isDeleted_idx" ON "Profitabilty_line_items"("quote_id", "isDeleted");

-- CreateIndex
CREATE INDEX "Profitabilty_line_items_userId_isDeleted_createdAt_idx" ON "Profitabilty_line_items"("userId", "isDeleted", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "Profitabilty_line_items" ADD CONSTRAINT "Profitabilty_line_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profitabilty_line_items" ADD CONSTRAINT "Profitabilty_line_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profitabilty_line_items" ADD CONSTRAINT "Profitabilty_line_items_pdfTableId_fkey" FOREIGN KEY ("pdfTableId") REFERENCES "PdfTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profitabilty_line_items" ADD CONSTRAINT "Profitabilty_line_items_quote_file_id_fkey" FOREIGN KEY ("quote_file_id") REFERENCES "QuoteFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
