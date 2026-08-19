-- Let each roster define how many work-hours one shift is worth, so the AI
-- assignment step can convert shift counts to hour totals without needing to
-- compute actual durations from each shift template's start/end time.
ALTER TABLE "Roster" ADD COLUMN "hoursPerShift" DOUBLE PRECISION NOT NULL DEFAULT 8;
