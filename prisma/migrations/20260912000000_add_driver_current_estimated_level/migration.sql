ALTER TABLE "Driver" ADD COLUMN "currentEstimatedLevel" TEXT;

CREATE INDEX "Driver_currentEstimatedLevel_idx" ON "Driver"("currentEstimatedLevel");
