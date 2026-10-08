-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "bannedUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
