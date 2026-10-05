-- Arama, moderasyon ve raporlama (v4.3.0)

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "searchText" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Project" ADD COLUMN     "hiddenAt" TIMESTAMP(3);
ALTER TABLE "Comment" ADD COLUMN     "hiddenAt" TIMESTAMP(3),
ADD COLUMN     "hiddenById" TEXT;

-- Mevcut kayıtların arama metni: Türkçe harfleri katlayıp küçült.
-- translate() eşit uzunlukta İKİ dizi ister; `to` kısa kalırsa fazladan harf
-- sessizce SİLİNİR (bu hatada 'ç' kayboluyordu). 13 → 13 sayıldı.
UPDATE "Project"
SET "searchText" = lower(
  translate("title" || ' ' || "summary", 'İIıŞşĞğÜüÖöÇç', 'iiissgguuoocc')
);

-- CreateIndex
CREATE UNIQUE INDEX "Report_reporterId_targetType_targetId_key" ON "Report"("reporterId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
