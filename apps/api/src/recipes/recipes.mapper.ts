import { Prisma } from "../generated/prisma/client";
import { RecipeDetailDto, RecipeIngredientDto, RecipeListItemDto } from "./dto/recipe-response.dto";

/** The query shape the detail mapper depends on. Exported because the service
must fetch with exactly this include: the mapper derives its input type from
the same constant, so query and type cannot drift apart. */
export const recipeIngredientInclude = {
    recipeIngredients: {
        orderBy: { position: 'asc' },
        include: {
            ingredient: { select: { name: true, } }
        },
    }
} satisfies Prisma.RecipeInclude;

type Recipe = Prisma.RecipeGetPayload<{
    include: typeof recipeIngredientInclude;
}>;


/** Flattens one join row into a response line. The name lives one table deeper
and moves up; `amount` leaves Prisma as a Decimal object, which would serialise
to a quoted string. The row's own `id` and `recipeId` are dropped on purpose —
neither means anything outside the database. */
function toRecipeIngredient(line: Recipe['recipeIngredients'][number],
): RecipeIngredientDto {
    return {
        ingredientId: line.ingredientId,
        name: line.ingredient.name,
        amount: line.amount === null ? null : line.amount.toNumber(),
        unit: line.unit,
        note: line.note,
        groupLabel: line.groupLabel,
        position: line.position,
    };
}

export function toRecipeDetail(item: Recipe): RecipeDetailDto {
    return {
        description: item.description,
        instructions: item.instructions,
        id: item.id,
        title: item.title,
        servings: item.servings,
        prepMinutes: item.prepMinutes,
        totalMinutes: item.totalMinutes,
        ingredients: item.recipeIngredients.map(toRecipeIngredient),
    }
}

export const recipeListSelect = {
    id: true,
    title: true,
    servings: true,
    prepMinutes: true,
    totalMinutes: true
} satisfies Prisma.RecipeSelect;

type RecipeListItem = Prisma.RecipeGetPayload<{
    select: typeof recipeListSelect;
}>;


export function toRecipeListItem(item: RecipeListItem): RecipeListItemDto {
    return {
        id: item.id,
        title: item.title,
        servings: item.servings,
        prepMinutes: item.prepMinutes,
        totalMinutes: item.totalMinutes,
    }
}