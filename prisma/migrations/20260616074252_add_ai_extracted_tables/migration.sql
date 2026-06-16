-- CreateTable
CREATE TABLE "AiExtractedTable" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "columns" JSONB NOT NULL,
    "sourceFileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AiExtractedTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiExtractedRow" (
    "id" TEXT NOT NULL,
    "aiExtractedTableId" TEXT NOT NULL,
    "rowData" JSONB NOT NULL,
    "rowIndex" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AiExtractedRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiExtractedTable_userId_idx" ON "AiExtractedTable"("userId");

-- CreateIndex
CREATE INDEX "AiExtractedTable_isDeleted_idx" ON "AiExtractedTable"("isDeleted");

-- CreateIndex
CREATE INDEX "AiExtractedRow_aiExtractedTableId_idx" ON "AiExtractedRow"("aiExtractedTableId");

-- CreateIndex
CREATE INDEX "AiExtractedRow_isDeleted_idx" ON "AiExtractedRow"("isDeleted");

-- AddForeignKey
ALTER TABLE "AiExtractedTable" ADD CONSTRAINT "AiExtractedTable_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiExtractedRow" ADD CONSTRAINT "AiExtractedRow_aiExtractedTableId_fkey" FOREIGN KEY ("aiExtractedTableId") REFERENCES "AiExtractedTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
