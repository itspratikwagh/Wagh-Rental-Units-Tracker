/*
  Warnings:

  - You are about to drop the column `frequency` on the `Expense` table. All the data in the column will be lost.
  - You are about to drop the column `isRecurring` on the `Expense` table. All the data in the column will be lost.
  - You are about to drop the column `nextDueDate` on the `Expense` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Expense" DROP COLUMN "frequency",
DROP COLUMN "isRecurring",
DROP COLUMN "nextDueDate";
