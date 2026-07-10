-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarColor" TEXT,
ADD COLUMN     "avatarImage" TEXT,
ADD COLUMN     "colorPrefs" JSONB;

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "iconColor" TEXT,
ADD COLUMN     "iconImage" TEXT;

