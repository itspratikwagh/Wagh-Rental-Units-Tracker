-- AlterTable: add soft-delete column to all data tables
ALTER TABLE "Expense" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Property" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "RecurringExpense" ADD COLUMN "deletedAt" TIMESTAMP(3);
