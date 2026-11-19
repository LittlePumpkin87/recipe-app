/*
  Warnings:

  - A unique constraint covering the columns `[name_normalized,language]` on the table `ingredient` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `language` to the `ingredient` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "ingredient_name_normalized_key";

-- AlterTable
ALTER TABLE "ingredient" ADD COLUMN     "language" "language";
UPDATE "ingredient"
SET "language" = CASE WHEN "name_en" IS NULL THEN 'DE'::"language" ELSE 'EN'::language END;

ALTER TABLE "ingredient" ALTER COLUMN "language" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_name_normalized_language_key" ON "ingredient"("name_normalized", "language");
