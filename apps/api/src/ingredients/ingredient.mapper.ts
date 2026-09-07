import { Prisma } from "../generated/prisma/client";
import { IngredientDto } from "./dto/ingredient-response.dto";


export const ingredientSelect = {
    id: true,
    name: true,
    defaultUnit: true
} satisfies Prisma.IngredientSelect;

type IngredientItem = Prisma.IngredientGetPayload<{
    select: typeof ingredientSelect;
}>;

export function toIngredient(line: IngredientItem
): IngredientDto {
    return {
        name: line.name,
        defaultUnit: line.defaultUnit,
        id: line.id
    };
}