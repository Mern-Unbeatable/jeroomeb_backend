-- AlterTable
ALTER TABLE "ServiceRequest" ADD COLUMN "stripeCheckoutSessionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRequest_stripeCheckoutSessionId_key" ON "ServiceRequest"("stripeCheckoutSessionId");
