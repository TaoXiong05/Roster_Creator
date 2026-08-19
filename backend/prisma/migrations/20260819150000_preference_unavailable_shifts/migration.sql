-- Add unavailableShifts, mirroring preferredShifts as a list of
-- {weekday, shiftTemplateId} pairs the staff member cannot work.
ALTER TABLE "Preference" ADD COLUMN "unavailableShifts" JSONB NOT NULL DEFAULT '[]';
