/*
  Warnings:

  - Added the required column `category` to the `Expense` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Expense` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "category" TEXT NOT NULL,
ADD COLUMN     "frequency" TEXT,
ADD COLUMN     "isRecurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nextDueDate" TIMESTAMP(3),
ADD COLUMN     "type" TEXT NOT NULL;
