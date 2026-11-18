-- Código importado do GitHub na Biblioteca (colunas novas, todas opcionais).
-- Escrita manualmente: o `migrate dev` exige confirmação interativa por causa do índice único,
-- que é seguro aqui (coluna nova, só NULLs; no SQLite, NULLs não conflitam em índices únicos).
ALTER TABLE "LibraryEntry" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "LibraryEntry" ADD COLUMN "sourceLabel" TEXT;
ALTER TABLE "LibraryEntry" ADD COLUMN "sourceLanguage" TEXT;
ALTER TABLE "LibraryEntry" ADD COLUMN "sourceCode" TEXT;
ALTER TABLE "LibraryEntry" ADD COLUMN "sourceSyncedAt" DATETIME;

CREATE UNIQUE INDEX "LibraryEntry_sourceUrl_key" ON "LibraryEntry"("sourceUrl");
