-- AlterTable
ALTER TABLE "ingredient" ALTER COLUMN "id" SET DEFAULT uuidv7();

-- AlterTable
ALTER TABLE "ingredient_alias" ALTER COLUMN "id" SET DEFAULT uuidv7();

-- AlterTable
ALTER TABLE "recipe" ALTER COLUMN "id" SET DEFAULT uuidv7(),
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "recipe_ingredient" ALTER COLUMN "id" SET DEFAULT uuidv7();
