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
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "authProvider" "AuthProvider" NOT NULL DEFAULT 'CREDENTIALS',
    "providerAccountId" TEXT,
    "organizationName" TEXT,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedTable" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceFileName" TEXT,
    "contentHash" TEXT,
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
CREATE TABLE "Partner" (
    "id" SERIAL NOT NULL,
    "externalId" TEXT,
    "partnerName" TEXT NOT NULL,
    "parentPartner" TEXT,
    "pmId" TEXT,
    "url" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerProgram" (
    "id" SERIAL NOT NULL,
    "partnerProgramName" TEXT NOT NULL,
    "description" TEXT,
    "verificationStep" BOOLEAN NOT NULL DEFAULT false,
    "template" TEXT,
    "loginTemplate" TEXT,
    "loginScript" TEXT,
    "partnerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerProgram_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "User_authProvider_providerAccountId_key" ON "User"("authProvider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_domain_key" ON "Organization"("domain");

-- CreateIndex
CREATE INDEX "Organization_name_idx" ON "Organization"("name");

-- CreateIndex
CREATE INDEX "ExtractedTable_userId_idx" ON "ExtractedTable"("userId");

-- CreateIndex
CREATE INDEX "ExtractedTable_userId_schemaHash_idx" ON "ExtractedTable"("userId", "schemaHash");

-- CreateIndex
CREATE INDEX "ExtractedTable_userId_tableHash_idx" ON "ExtractedTable"("userId", "tableHash");

-- CreateIndex
CREATE UNIQUE INDEX "ExtractedTable_userId_tableHash_key" ON "ExtractedTable"("userId", "tableHash");

-- CreateIndex
CREATE INDEX "ExtractedRow_extractedTableId_idx" ON "ExtractedRow"("extractedTableId");

-- CreateIndex
CREATE INDEX "ExtractedRow_extractedTableId_isDeleted_rowIndex_idx" ON "ExtractedRow"("extractedTableId", "isDeleted", "rowIndex");

-- CreateIndex
CREATE UNIQUE INDEX "ExtractedRow_extractedTableId_rowHash_key" ON "ExtractedRow"("extractedTableId", "rowHash");

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

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "Contact_email_idx" ON "Contact"("email");

-- CreateIndex
CREATE INDEX "Contact_userId_idx" ON "Contact"("userId");

-- CreateIndex
CREATE INDEX "Contact_createdAt_idx" ON "Contact"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_partnerName_key" ON "Partner"("partnerName");

-- CreateIndex
CREATE INDEX "Partner_partnerName_idx" ON "Partner"("partnerName");

-- CreateIndex
CREATE INDEX "PartnerProgram_partnerId_idx" ON "PartnerProgram"("partnerId");

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
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedTable" ADD CONSTRAINT "ExtractedTable_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedRow" ADD CONSTRAINT "ExtractedRow_extractedTableId_fkey" FOREIGN KEY ("extractedTableId") REFERENCES "ExtractedTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfUpload" ADD CONSTRAINT "PdfUpload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfTable" ADD CONSTRAINT "PdfTable_pdfUploadId_fkey" FOREIGN KEY ("pdfUploadId") REFERENCES "PdfUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfTable" ADD CONSTRAINT "PdfTable_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfTableRow" ADD CONSTRAINT "PdfTableRow_pdfTableId_fkey" FOREIGN KEY ("pdfTableId") REFERENCES "PdfTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerProgram" ADD CONSTRAINT "PartnerProgram_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserContact" ADD CONSTRAINT "UserContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
