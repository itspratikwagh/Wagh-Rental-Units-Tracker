-- CreateTable
CREATE TABLE "ScanRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'running',
    "totalFetched" INTEGER NOT NULL DEFAULT 0,
    "newEmails" INTEGER NOT NULL DEFAULT 0,
    "payments" INTEGER NOT NULL DEFAULT 0,
    "expenses" INTEGER NOT NULL DEFAULT 0,
    "autoRejected" INTEGER NOT NULL DEFAULT 0,
    "autoApproved" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT,

    CONSTRAINT "ScanRun_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "PendingTransaction" ADD COLUMN "autoApproved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PendingTransaction" ADD COLUMN "createdRecordType" TEXT;
ALTER TABLE "PendingTransaction" ADD COLUMN "createdRecordId" TEXT;
