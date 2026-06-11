-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('CREDENTIALS', 'GOOGLE', 'MICROSOFT');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('PRIMARY', 'SECONDARY');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "authProvider" "AuthProvider" NOT NULL DEFAULT 'CREDENTIALS',
    "providerAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdfDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "contentHash" TEXT,
    "extractedText" TEXT,
    "extractedData" JSONB,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdfDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedTable" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pdfDocumentId" TEXT NOT NULL,
    "title" TEXT,
    "tableHash" TEXT NOT NULL,
    "schemaHash" TEXT NOT NULL,
    "columns" JSONB NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtractedTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedRow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "extractedTableId" TEXT NOT NULL,
    "rowHash" TEXT NOT NULL,
    "rowData" JSONB NOT NULL,
    "rowIndex" INTEGER,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtractedRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT NOT NULL,
    "primaryContact" TEXT NOT NULL,
    "secondaryContact" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserContact" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT NOT NULL,
    "primaryContact" TEXT NOT NULL,
    "secondaryContact" TEXT,
    "company" TEXT,
    "notes" TEXT,
    "contactType" "ContactType" NOT NULL DEFAULT 'PRIMARY',
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_authProvider_providerAccountId_key" ON "User"("authProvider", "providerAccountId");

-- CreateIndex
CREATE INDEX "PdfDocument_userId_idx" ON "PdfDocument"("userId");

-- CreateIndex
CREATE INDEX "ExtractedTable_userId_idx" ON "ExtractedTable"("userId");

-- CreateIndex
CREATE INDEX "ExtractedTable_pdfDocumentId_idx" ON "ExtractedTable"("pdfDocumentId");

-- CreateIndex
CREATE INDEX "ExtractedTable_userId_schemaHash_idx" ON "ExtractedTable"("userId", "schemaHash");

-- CreateIndex
CREATE UNIQUE INDEX "ExtractedTable_userId_tableHash_key" ON "ExtractedTable"("userId", "tableHash");

-- CreateIndex
CREATE INDEX "ExtractedRow_userId_idx" ON "ExtractedRow"("userId");

-- CreateIndex
CREATE INDEX "ExtractedRow_extractedTableId_idx" ON "ExtractedRow"("extractedTableId");

-- CreateIndex
CREATE UNIQUE INDEX "ExtractedRow_extractedTableId_rowHash_key" ON "ExtractedRow"("extractedTableId", "rowHash");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "Contact_email_idx" ON "Contact"("email");

-- CreateIndex
CREATE INDEX "Contact_userId_idx" ON "Contact"("userId");

-- CreateIndex
CREATE INDEX "Contact_createdAt_idx" ON "Contact"("createdAt");

-- CreateIndex
CREATE INDEX "UserContact_userId_idx" ON "UserContact"("userId");

-- CreateIndex
CREATE INDEX "UserContact_email_idx" ON "UserContact"("email");

-- CreateIndex
CREATE INDEX "UserContact_contactType_idx" ON "UserContact"("contactType");

-- CreateIndex
CREATE UNIQUE INDEX "UserContact_userId_email_key" ON "UserContact"("userId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "UserContact_userId_primaryContact_key" ON "UserContact"("userId", "primaryContact");

-- AddForeignKey
ALTER TABLE "PdfDocument" ADD CONSTRAINT "PdfDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedTable" ADD CONSTRAINT "ExtractedTable_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedTable" ADD CONSTRAINT "ExtractedTable_pdfDocumentId_fkey" FOREIGN KEY ("pdfDocumentId") REFERENCES "PdfDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedRow" ADD CONSTRAINT "ExtractedRow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedRow" ADD CONSTRAINT "ExtractedRow_extractedTableId_fkey" FOREIGN KEY ("extractedTableId") REFERENCES "ExtractedTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserContact" ADD CONSTRAINT "UserContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
