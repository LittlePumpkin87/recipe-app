import { Prisma } from "../generated/prisma/client";
import { IngredientDto } from "./dto/ingredient.dto";


/** The columns the ingredient endpoints return. */
export const ingredientSelect = {
    id: true,
    name: true,
    defaultUnit: true
} satisfies Prisma.IngredientSelect;

type IngredientItem = Prisma.IngredientGetPayload<{
    select: typeof ingredientSelect;
}>;

export function toIngredient(ingredient: IngredientItem
): IngredientDto {
    return {
        name: ingredient.name,
        defaultUnit: ingredient.defaultUnit,
        id: ingredient.id
    };
}