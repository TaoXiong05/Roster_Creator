-- Replace the separate preferredWeekdays / preferredShiftTemplateIds arrays with a single
-- preferredShifts list of { weekday, shiftTemplateId } pairs, so a staff member's shift
-- preference is stored per weekday instead of as two unrelated flat lists.
ALTER TABLE "Preference" DROP COLUMN "preferredShiftTemplateIds";
ALTER TABLE "Preference" DROP COLUMN "preferredWeekdays";
ALTER TABLE "Preference" ADD COLUMN "preferredShifts" JSONB NOT NULL DEFAULT '[]';
