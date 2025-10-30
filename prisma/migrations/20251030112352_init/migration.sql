/*
  Warnings:

  - The values [EMPLOYEE,CEO] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `autoReleaseAt` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `cost` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `duration` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `flexibility` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `organizerId` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `preferredStart` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `priority` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Ticket` table. All the data in the column will be lost.
  - You are about to drop the `MeetingRoom` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[ticketId]` on the table `Booking` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Made the column `roomId` on table `Booking` required. This step will fail if there are existing NULL values in that column.
  - Made the column `startTime` on table `Booking` required. This step will fail if there are existing NULL values in that column.
  - Made the column `endTime` on table `Booking` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `eventId` to the `Ticket` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Ticket` table without a default value. This is not possible if the table is not empty.
  - Made the column `password` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'USER');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."Booking" DROP CONSTRAINT "Booking_organizerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Booking" DROP CONSTRAINT "Booking_roomId_fkey";

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "autoReleaseAt",
DROP COLUMN "cost",
DROP COLUMN "duration",
DROP COLUMN "flexibility",
DROP COLUMN "organizerId",
DROP COLUMN "preferredStart",
DROP COLUMN "priority",
ADD COLUMN     "actualEnd" TIMESTAMP(3),
ADD COLUMN     "userId" TEXT NOT NULL,
ALTER COLUMN "roomId" SET NOT NULL,
ALTER COLUMN "attendees" DROP DEFAULT,
ALTER COLUMN "requiredEquipment" DROP DEFAULT,
ALTER COLUMN "startTime" SET NOT NULL,
ALTER COLUMN "endTime" SET NOT NULL;

-- AlterTable
ALTER TABLE "Ticket" DROP COLUMN "title",
ADD COLUMN     "eventId" TEXT NOT NULL,
ADD COLUMN     "type" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "password" SET NOT NULL,
ALTER COLUMN "role" SET DEFAULT 'USER';

-- DropTable
DROP TABLE "public"."MeetingRoom";

-- DropEnum
DROP TYPE "public"."Priority";

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "location" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Booking_ticketId_key" ON "Booking"("ticketId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
