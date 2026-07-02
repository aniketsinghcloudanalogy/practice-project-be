-- AlterTable
ALTER TABLE "UserContact" ADD COLUMN     "customerId" TEXT;

-- CreateIndex
CREATE INDEX "UserContact_customerId_idx" ON "UserContact"("customerId");

-- AddForeignKey
ALTER TABLE "UserContact" ADD CONSTRAINT "UserContact_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
