-- Multi-room Airbnb: data-only migration (no schema changes).
-- Renames the Airbnb pseudo-tenant to "Airbnb 01", creates "Airbnb 02" for the
-- second Calgary room (starts Aug 2026, foregone rent $600/mo), attributes all
-- historical Airbnb expenses to rooms via the existing Expense.tenantId FK,
-- and seeds listing-name aliases so payout emails auto-match the right room.

-- 1. Rename + correct foregone rent ($1,125/mo) and start month (Apr 2026)
UPDATE "Tenant"
SET name = 'Airbnb 01', "rentAmount" = 1125, "leaseStart" = '2026-04-01T00:00:00Z', "updatedAt" = NOW()
WHERE name = 'Airbnb' AND "deletedAt" IS NULL;

-- 2. Keep any alias rules pointing at the old name alive
UPDATE "SenderRule" SET "tenantName" = 'Airbnb 01', "updatedAt" = NOW()
WHERE kind = 'alias' AND "tenantName" = 'Airbnb';

-- 3. Create Airbnb 02 (Calgary House) — email/phone are required strings
INSERT INTO "Tenant" (id, name, email, phone, "propertyId", "rentAmount", "leaseStart", "leaseEnd", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'Airbnb 02', '', '', 'd1d290af-2d3e-4f39-92c4-fa5465466476', 600,
       '2026-08-01T00:00:00Z', '2027-08-01T00:00:00Z', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Tenant" WHERE name = 'Airbnb 02' AND "deletedAt" IS NULL);

-- 4. Backfill all pre-July Airbnb expenses to room 01
UPDATE "Expense"
SET "tenantId" = (SELECT id FROM "Tenant" WHERE name = 'Airbnb 01' AND "deletedAt" IS NULL), "updatedAt" = NOW()
WHERE category = 'Airbnb' AND "deletedAt" IS NULL AND date < '2026-07-01T00:00:00Z';

-- 5. July Airbnb expenses default to room 02 (its setup costs)
UPDATE "Expense"
SET "tenantId" = (SELECT id FROM "Tenant" WHERE name = 'Airbnb 02' AND "deletedAt" IS NULL), "updatedAt" = NOW()
WHERE category = 'Airbnb' AND "deletedAt" IS NULL
  AND date >= '2026-07-01T00:00:00Z' AND date < '2026-08-01T00:00:00Z';

-- 6. Two July exceptions belong to room 01 (amount guard protects the $194.81 quilt order)
UPDATE "Expense"
SET "tenantId" = (SELECT id FROM "Tenant" WHERE name = 'Airbnb 01' AND "deletedAt" IS NULL), "updatedAt" = NOW()
WHERE category = 'Airbnb' AND "deletedAt" IS NULL
  AND date >= '2026-07-01T00:00:00Z' AND date < '2026-08-01T00:00:00Z'
  AND ((amount = 495 AND description ILIKE '%Madhu%') OR (amount = 47.24 AND description ILIKE '%Quilt%'));

-- 7. Listing-name aliases: payout emails carry the listing name; the AI scanner
--    matches it against these to assign income to the right room
INSERT INTO "SenderRule" (id, kind, "senderName", "tenantName", notes, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'alias', 'Private Bedroom & Kitchen-Quiet, Near Airport', 'Airbnb 01',
       'Airbnb listing name (payout emails) for room 01', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "SenderRule" WHERE "senderName" = 'Private Bedroom & Kitchen-Quiet, Near Airport');

INSERT INTO "SenderRule" (id, kind, "senderName", "tenantName", notes, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'alias', 'Private Room w/ Mini Fridge & Coffee-Near Airport', 'Airbnb 02',
       'Airbnb listing name (payout emails) for room 02', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "SenderRule" WHERE "senderName" = 'Private Room w/ Mini Fridge & Coffee-Near Airport');
