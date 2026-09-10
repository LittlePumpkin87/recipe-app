import { Prisma } from "../generated/prisma/client";
import { IngredientDto } from "./dto/ingredient.dto";


/** The columns the ingredient endpoints return. `nameNormalized` is left out on
purpose — it exists for the unique index and the search and means nothing to a
client, so it is never even fetched. The mapper derives its input type from this
same constant, which keeps query and type from drifting apart. */
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