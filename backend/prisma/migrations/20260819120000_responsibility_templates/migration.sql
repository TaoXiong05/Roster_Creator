-- Add a user-managed list of responsibility templates (职责模版), and let each
-- staff member be tagged with any number of them.
ALTER TABLE "Staff" ADD COLUMN "responsibilityIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "ResponsibilityTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResponsibilityTemplate_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ResponsibilityTemplate" ADD CONSTRAINT "ResponsibilityTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
