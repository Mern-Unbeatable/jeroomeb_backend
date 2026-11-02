-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "checklistsAvailable247" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "scheduledAt" TIMESTAMP(3);
