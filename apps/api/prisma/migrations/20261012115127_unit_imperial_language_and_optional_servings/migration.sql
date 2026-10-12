-- CreateEnum
CREATE TYPE "language" AS ENUM ('DE', 'EN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "unit" ADD VALUE 'OUNCE';
ALTER TYPE "unit" ADD VALUE 'POUND';
ALTER TYPE "unit" ADD VALUE 'PINT';
ALTER TYPE "unit" ADD VALUE 'QUART';

-- AlterTable
ALTER TABLE "recipe" ADD COLUMN     "language" "language" NOT NULL DEFAULT 'EN';
