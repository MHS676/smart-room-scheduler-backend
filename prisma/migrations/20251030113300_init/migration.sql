/*
  Warnings:

  - The values [IN_PROGRESS] on the enum `BookingStatus` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[title]` on the table `Ticket` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "BookingStatus_new" AS ENUM ('PENDING', 'SCHEDULED', 'CANCELLED', 'RELEASED', 'COMPLETED', 'NO_SHOW');
ALTER TABLE "public"."Booking" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Booking" ALTER COLUMN "status" TYPE "BookingStatus_new" USING ("status"::text::"BookingStatus_new");
ALTER TYPE "BookingStatus" RENAME TO "BookingStatus_old";
ALTER TYPE "BookingStatus_new" RENAME TO "BookingStatus";
DROP TYPE "public"."BookingStatus_old";
ALTER TABLE "Booking" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_title_key" ON "Ticket"("title");
