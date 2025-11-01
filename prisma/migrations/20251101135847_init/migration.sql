-- CreateEnum
CREATE TYPE "Role" AS ENUM ('EMPLOYEE', 'ADMIN', 'CEO');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'SCHEDULED', 'CANCELLED', 'RELEASED', 'COMPLETED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "meetingRoomId" TEXT NOT NULL,
    "ticketId" TEXT,
    "attendeesCount" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "requiredEquipment" TEXT[],
    "preferredStart" TIMESTAMP(3) NOT NULL,
    "flexibility" INTEGER NOT NULL,
    "priority" "Priority" NOT NULL,
    "ticketTitle" TEXT NOT NULL,
    "cost" DOUBLE PRECISION,
    "autoReleaseAt" TIMESTAMP(3),
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "status" "BookingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingRoom_name_key" ON "MeetingRoom"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_title_key" ON "Ticket"("title");

-- CreateIndex
CREATE INDEX "Ticket_title_idx" ON "Ticket"("title");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_meetingRoomId_fkey" FOREIGN KEY ("meetingRoomId") REFERENCES "MeetingRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
