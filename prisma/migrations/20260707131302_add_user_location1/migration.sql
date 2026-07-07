-- CreateTable
CREATE TABLE "SavedLocation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "shareToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SavedLocation_shareToken_key" ON "SavedLocation"("shareToken");

-- CreateIndex
CREATE INDEX "SavedLocation_userId_idx" ON "SavedLocation"("userId");

-- CreateIndex
CREATE INDEX "SavedLocation_shareToken_idx" ON "SavedLocation"("shareToken");

-- AddForeignKey
ALTER TABLE "SavedLocation" ADD CONSTRAINT "SavedLocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
