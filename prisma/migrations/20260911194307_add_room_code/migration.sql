/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `Room` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Room_code_key" ON "Room"("code");
