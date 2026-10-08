import { Prisma } from "../generated/prisma/client";
import { RecipeDetailDto, RecipeIngredientDto, RecipeListItemDto } from "./dto/recipe.dto";

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
function toRecipeIngredient(recipeIngredient: Recipe['recipeIngredients'][number],
): RecipeIngredientDto {
    return {
        ingredientId: recipeIngredient.ingredientId,
        name: recipeIngredient.ingredient.name,
        amount: recipeIngredient.amount === null ? null : recipeIngredient.amount.toNumber(),
        unit: recipeIngredient.unit,
        note: recipeIngredient.note,
        groupLabel: recipeIngredient.groupLabel,
        position: recipeIngredient.position,
    };
}

export function toRecipeDetail(recipe: Recipe): RecipeDetailDto {
    return {
        description: recipe.description,
        instructions: recipe.instructions,
        id: recipe.id,
        title: recipe.title,
        servings: recipe.servings,
        prepMinutes: recipe.prepMinutes,
        totalMinutes: recipe.totalMinutes,
        ingredients: recipe.recipeIngredients.map(toRecipeIngredient),
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


export function toRecipeListItem(recipe: RecipeListItem): RecipeListItemDto {
    return {
        id: recipe.id,
        title: recipe.title,
        servings: recipe.servings,
        prepMinutes: recipe.prepMinutes,
        totalMinutes: recipe.totalMinutes,
    }
}