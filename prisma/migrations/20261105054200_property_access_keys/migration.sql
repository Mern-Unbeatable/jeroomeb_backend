-- CreateTable
CREATE TABLE "PropertyAccess" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "mainEntryInstructions" TEXT,
    "buildingAccessCode" TEXT,
    "elevatorAccess" TEXT,
    "lockboxCode" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactTitle" TEXT,
    "emergencyContactPhone" TEXT,
    "additionalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PropertyAccess_propertyId_key" ON "PropertyAccess"("propertyId");

-- AddForeignKey
ALTER TABLE "PropertyAccess" ADD CONSTRAINT "PropertyAccess_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
