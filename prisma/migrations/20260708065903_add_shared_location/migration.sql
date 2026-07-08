-- CreateTable
CREATE TABLE "SharedLocation" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "sharedById" TEXT NOT NULL,
    "sharedToId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SharedLocation_sharedById_idx" ON "SharedLocation"("sharedById");

-- CreateIndex
CREATE INDEX "SharedLocation_sharedToId_idx" ON "SharedLocation"("sharedToId");

-- CreateIndex
CREATE UNIQUE INDEX "SharedLocation_locationId_sharedToId_key" ON "SharedLocation"("locationId", "sharedToId");

-- AddForeignKey
ALTER TABLE "SharedLocation" ADD CONSTRAINT "SharedLocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "SavedLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedLocation" ADD CONSTRAINT "SharedLocation_sharedById_fkey" FOREIGN KEY ("sharedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedLocation" ADD CONSTRAINT "SharedLocation_sharedToId_fkey" FOREIGN KEY ("sharedToId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
