-- Replace the unused free-form requiredSkills list with a proper responsibilityId
-- so each roster shift requirement can be tied to a responsibility template.
ALTER TABLE "RosterShift" ADD COLUMN "responsibilityId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "RosterShift" DROP COLUMN "requiredSkills";
