/*
  Warnings:

  - You are about to drop the column `category` on the `Expense` table. All the data in the column will be lost.
  - Made the column `description` on table `Expense` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Expense" DROP COLUMN "category",
ADD COLUMN     "tenantId" TEXT,
ALTER COLUMN "description" SET NOT NULL;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
