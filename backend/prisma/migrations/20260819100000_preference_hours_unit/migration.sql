-- Add hoursUnit so a staff member's min/max limit can be measured in hours
-- or in a raw shift count, not just hours.
ALTER TABLE "Preference" ADD COLUMN "hoursUnit" TEXT NOT NULL DEFAULT 'hours';
