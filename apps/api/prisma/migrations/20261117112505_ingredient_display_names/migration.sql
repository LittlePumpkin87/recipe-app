-- Rename instead of drop: keeps the existing names.
ALTER TABLE ingredient RENAME COLUMN name TO name_en;
ALTER TABLE ingredient ALTER COLUMN name_en DROP NOT NULL;

ALTER TABLE "ingredient"
ADD COLUMN     "name_de" VARCHAR(120),
ADD COLUMN     "name_de_plural" VARCHAR(120),
ADD COLUMN     "name_en_plural" VARCHAR(120);

ALTER TABLE ingredient
  ADD CONSTRAINT ingredient_has_name_check
  CHECK (num_nonnulls(name_en, name_en_plural, name_de, name_de_plural) >= 1);