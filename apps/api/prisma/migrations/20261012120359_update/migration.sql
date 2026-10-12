-- AlterTable
ALTER TABLE "recipe" ALTER COLUMN "servings" DROP NOT NULL,
ALTER COLUMN "language" SET DEFAULT 'DE';
