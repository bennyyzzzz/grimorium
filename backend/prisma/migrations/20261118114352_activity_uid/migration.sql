-- Adiciona Activity.uid (identificador universal usado na exportação/importação).
-- Ajuste manual: as linhas existentes recebem um UUID v4 gerado no próprio SQLite.
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Activity" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TASK',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "importance" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "dueDate" TEXT,
    "completedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    "channel" TEXT,
    "contactName" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "externalId" TEXT
);
INSERT INTO "new_Activity" ("uid", "category", "channel", "completedAt", "contactName", "createdAt", "description", "dueDate", "externalId", "id", "importance", "source", "startedAt", "status", "title", "type", "updatedAt") SELECT
    lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' ||
    substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
    "category", "channel", "completedAt", "contactName", "createdAt", "description", "dueDate", "externalId", "id", "importance", "source", "startedAt", "status", "title", "type", "updatedAt" FROM "Activity";
DROP TABLE "Activity";
ALTER TABLE "new_Activity" RENAME TO "Activity";
CREATE UNIQUE INDEX "Activity_uid_key" ON "Activity"("uid");
CREATE INDEX "Activity_status_idx" ON "Activity"("status");
CREATE INDEX "Activity_dueDate_idx" ON "Activity"("dueDate");
CREATE INDEX "Activity_type_idx" ON "Activity"("type");
CREATE UNIQUE INDEX "Activity_source_externalId_key" ON "Activity"("source", "externalId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
