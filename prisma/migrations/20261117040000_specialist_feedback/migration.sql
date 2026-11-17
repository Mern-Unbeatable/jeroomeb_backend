-- CreateTable
CREATE TABLE "SpecialistFeedback" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "specialistId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpecialistFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpecialistFeedback_organizationId_createdAt_idx" ON "SpecialistFeedback"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "SpecialistFeedback" ADD CONSTRAINT "SpecialistFeedback_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistFeedback" ADD CONSTRAINT "SpecialistFeedback_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistFeedback" ADD CONSTRAINT "SpecialistFeedback_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "SpecialistProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
