-- CreateEnum
CREATE TYPE "unit" AS ENUM ('GRAM', 'KILOGRAM', 'MILLILITER', 'LITER', 'PIECE', 'CUP', 'TABLESPOON', 'TEASPOON', 'PINCH', 'BUNCH', 'CLOVE', 'SLICE', 'PACK', 'CAN');

-- CreateTable
CREATE TABLE "recipe" (
    "id" UUID NOT NULL,
    "title" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "instructions" TEXT NOT NULL,
    "servings" INTEGER NOT NULL DEFAULT 2,
    "prep_minutes" INTEGER,
    "source_url" TEXT,
    "source_name" VARCHAR(150),
    "external_id" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredient" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "name_normalized" VARCHAR(120) NOT NULL,
    "default_unit" "unit",

    CONSTRAINT "ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredient_alias" (
    "id" UUID NOT NULL,
    "alias" VARCHAR(120) NOT NULL,
    "ingredient_id" UUID NOT NULL,

    CONSTRAINT "ingredient_alias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_ingredient" (
    "id" UUID NOT NULL,
    "amount" DECIMAL(8,2),
    "ingredient_id" UUID NOT NULL,
    "recipe_id" UUID NOT NULL,
    "unit" "unit",
    "note" VARCHAR(80),
    "group_label" VARCHAR(100),
    "position" INTEGER NOT NULL,

    CONSTRAINT "recipe_ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recipe_source_name_external_id_key" ON "recipe"("source_name", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_name_normalized_key" ON "ingredient"("name_normalized");

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_alias_alias_key" ON "ingredient_alias"("alias");

-- CreateIndex
CREATE INDEX "recipe_ingredient_ingredient_id_idx" ON "recipe_ingredient"("ingredient_id");

-- CreateIndex
CREATE INDEX "recipe_ingredient_recipe_id_idx" ON "recipe_ingredient"("recipe_id");

-- AddForeignKey
ALTER TABLE "ingredient_alias" ADD CONSTRAINT "ingredient_alias_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredient" ADD CONSTRAINT "recipe_ingredient_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredient" ADD CONSTRAINT "recipe_ingredient_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
