/*
  Warnings:

  - A unique constraint covering the columns `[alias,language]` on the table `ingredient_alias` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `language` to the `ingredient_alias` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "ingredient_alias_alias_key";

-- AlterTable
ALTER TABLE "ingredient_alias" ADD COLUMN     "language" "language" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_alias_alias_language_key" ON "ingredient_alias"("alias", "language");
