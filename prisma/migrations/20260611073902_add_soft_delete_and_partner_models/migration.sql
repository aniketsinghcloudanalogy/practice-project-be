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
    "verificationStep" BOOLEAN DEFAULT false,
    "template" TEXT,
    "loginTemplate" TEXT,
    "loginScript" TEXT,
    "partnerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerProgram_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Partner_externalId_key" ON "Partner"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_partnerName_key" ON "Partner"("partnerName");

-- CreateIndex
CREATE INDEX "PartnerProgram_partnerId_idx" ON "PartnerProgram"("partnerId");

-- AddForeignKey
ALTER TABLE "PartnerProgram" ADD CONSTRAINT "PartnerProgram_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
