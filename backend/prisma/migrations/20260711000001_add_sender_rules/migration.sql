-- CreateTable
CREATE TABLE "SenderRule" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "tenantName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SenderRule_pkey" PRIMARY KEY ("id")
);

-- Seed with the previously hard-coded aliases and skip rules
INSERT INTO "SenderRule" ("id", "kind", "senderName", "tenantName", "notes", "updatedAt") VALUES
  (gen_random_uuid()::text, 'alias', 'Savannah Hummel', 'Justin Sox', NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'alias', 'Godwin Antepim', 'Eunice Frimpomaa', NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'alias', 'Godwin Kofi Antepim', 'Eunice Frimpomaa', NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'alias', 'Parveen Simplii', 'Parveen Kumar', NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'skip', 'Kraken', NULL, 'Crypto exchange', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'skip', 'Sandip Das', NULL, 'Personal loan', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'skip', 'Evelyn Ackah', NULL, 'Immigration lawyer', CURRENT_TIMESTAMP);
