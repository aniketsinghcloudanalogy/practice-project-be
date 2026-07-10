/*
  Warnings:

  - You are about to drop the column `meetingLink` on the `Meeting` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[parentMeetingId,startTime]` on the table `Meeting` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "MeetingPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "Meeting" DROP COLUMN "meetingLink",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "department" TEXT,
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isRecurringException" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "meetingUrl" TEXT,
ADD COLUMN     "parentMeetingId" TEXT,
ADD COLUMN     "priority" "MeetingPriority" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "recurrenceEndDate" TIMESTAMP(3),
ADD COLUMN     "recurrenceRule" TEXT,
ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Meeting_status_startTime_idx" ON "Meeting"("status", "startTime");

-- CreateIndex
CREATE INDEX "Meeting_department_idx" ON "Meeting"("department");

-- CreateIndex
CREATE INDEX "Meeting_status_department_startTime_idx" ON "Meeting"("status", "department", "startTime");

-- CreateIndex
CREATE INDEX "Meeting_organizerId_isDeleted_startTime_idx" ON "Meeting"("organizerId", "isDeleted", "startTime");

-- CreateIndex
CREATE INDEX "Meeting_parentMeetingId_idx" ON "Meeting"("parentMeetingId");

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_parentMeetingId_startTime_key" ON "Meeting"("parentMeetingId", "startTime");

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_parentMeetingId_fkey" FOREIGN KEY ("parentMeetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
