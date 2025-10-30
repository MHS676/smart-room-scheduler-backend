/*
  Warnings:

  - The values [USER] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `actualEnd` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `eventId` on the `Ticket` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Ticket` table. All the data in the column will be lost.
  - You are about to drop the `Event` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Room` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `duration` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `flexibility` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizerId` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `preferredStart` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `Ticket` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'IN_PROGRESS';

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('EMPLOYEE', 'ADMIN', 'CEO');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'EMPLOYEE';
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."Booking" DROP CONSTRAINT "Booking_roomId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Booking" DROP CONSTRAINT "Booking_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Event" DROP CONSTRAINT "Event_createdById_fkey";

-- DropForeignKey
ALTER TABLE "public"."Ticket" DROP CONSTRAINT "Ticket_eventId_fkey";

-- DropIndex
DROP INDEX "public"."Booking_ticketId_key";

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "actualEnd",
DROP COLUMN "userId",
ADD COLUMN     "autoReleaseAt" TIMESTAMP(3),
ADD COLUMN     "cost" DOUBLE PRECISION,
ADD COLUMN     "duration" INTEGER NOT NULL,
ADD COLUMN     "flexibility" INTEGER NOT NULL,
ADD COLUMN     "organizerId" TEXT NOT NULL,
ADD COLUMN     "preferredStart" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
ALTER COLUMN "roomId" DROP NOT NULL,
ALTER COLUMN "attendees" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "requiredEquipment" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "startTime" DROP NOT NULL,
ALTER COLUMN "endTime" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Ticket" DROP COLUMN "eventId",
DROP COLUMN "type",
ADD COLUMN     "title" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL,
ALTER COLUMN "role" SET DEFAULT 'EMPLOYEE';

-- DropTable
DROP TABLE "public"."Event";

-- DropTable
DROP TABLE "public"."Room";

-- CreateTable
CREATE TABLE "MeetingRoom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "equipment" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hourlyRate" DOUBLE PRECISION NOT NULL,
    "location" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingRoom_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MeetingRoom_name_key" ON "MeetingRoom"("name");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "MeetingRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
