-- AlterEnum
ALTER TYPE "SubscriptionStatus" ADD VALUE 'UNPAID';

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "planKind" "PlanKind",
ADD COLUMN     "servicePriceBandId" TEXT,
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_servicePriceBandId_fkey" FOREIGN KEY ("servicePriceBandId") REFERENCES "ServicePriceBand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
