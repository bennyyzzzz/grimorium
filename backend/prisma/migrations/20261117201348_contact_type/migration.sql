-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Activity" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
INSERT INTO "new_Activity" ("category", "completedAt", "createdAt", "description", "dueDate", "id", "importance", "startedAt", "status", "title", "updatedAt") SELECT "category", "completedAt", "createdAt", "description", "dueDate", "id", "importance", "startedAt", "status", "title", "updatedAt" FROM "Activity";
DROP TABLE "Activity";
ALTER TABLE "new_Activity" RENAME TO "Activity";
CREATE INDEX "Activity_status_idx" ON "Activity"("status");
CREATE INDEX "Activity_dueDate_idx" ON "Activity"("dueDate");
CREATE INDEX "Activity_type_idx" ON "Activity"("type");
CREATE UNIQUE INDEX "Activity_source_externalId_key" ON "Activity"("source", "externalId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
