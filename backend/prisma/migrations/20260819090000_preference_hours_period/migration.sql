-- Generalize the hour-limit fields so a staff member's min/max hours can be
-- expressed weekly, fortnightly, or monthly instead of always being weekly.
ALTER TABLE "Preference" DROP COLUMN "minHoursPerWeek";
ALTER TABLE "Preference" DROP COLUMN "maxHoursPerWeek";
ALTER TABLE "Preference" ADD COLUMN "minHours" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Preference" ADD COLUMN "maxHours" DOUBLE PRECISION NOT NULL DEFAULT 40;
ALTER TABLE "Preference" ADD COLUMN "hoursPeriod" TEXT NOT NULL DEFAULT 'weekly';
