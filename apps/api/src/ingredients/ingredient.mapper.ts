import { Prisma } from '../generated/prisma/client';
import { IngredientDto } from './dto/ingredient.dto';

/** The columns the ingredient endpoints return. */
export const ingredientSelect = {
    id: true,
    nameEn: true,
    nameDe: true,
    nameDePlural: true,
    nameEnPlural: true,
    defaultUnit: true,
} satisfies Prisma.IngredientSelect;

type IngredientItem = Prisma.IngredientGetPayload<{
    select: typeof ingredientSelect;
}>;

export function toIngredient(ingredient: IngredientItem): IngredientDto {
    return {
        nameDe: ingredient.nameDe,
        nameEn: ingredient.nameEn,
        nameDePlural: ingredient.nameDePlural,
        nameEnPlural: ingredient.nameEnPlural,
        defaultUnit: ingredient.defaultUnit,
        id: ingredient.id,
    };
}
