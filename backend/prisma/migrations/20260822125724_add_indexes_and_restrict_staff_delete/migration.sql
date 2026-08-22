-- DropForeignKey
ALTER TABLE "Assignment" DROP CONSTRAINT "Assignment_staffId_fkey";

-- CreateIndex
CREATE INDEX "Assignment_rosterShiftId_idx" ON "Assignment"("rosterShiftId");

-- CreateIndex
CREATE INDEX "Assignment_staffId_idx" ON "Assignment"("staffId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "ResponsibilityTemplate_userId_idx" ON "ResponsibilityTemplate"("userId");

-- CreateIndex
CREATE INDEX "Roster_userId_idx" ON "Roster"("userId");

-- CreateIndex
CREATE INDEX "Roster_groupId_idx" ON "Roster"("groupId");

-- CreateIndex
CREATE INDEX "RosterShift_rosterId_idx" ON "RosterShift"("rosterId");

-- CreateIndex
CREATE INDEX "ShiftTemplate_userId_idx" ON "ShiftTemplate"("userId");

-- CreateIndex
CREATE INDEX "Staff_userId_idx" ON "Staff"("userId");

-- CreateIndex
CREATE INDEX "StaffGroup_userId_idx" ON "StaffGroup"("userId");

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
