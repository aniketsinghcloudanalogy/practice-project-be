-- AlterTable
ALTER TABLE "UserContact" ADD COLUMN     "isPrimaryBillingContact" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPrimaryShippingContact" BOOLEAN NOT NULL DEFAULT false;
