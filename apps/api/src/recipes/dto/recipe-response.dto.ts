import { Unit } from "../../generated/prisma/client";

export interface RecipeListItemDto {
    id: string;
    title: string;
    servings: number;
    prepMinutes: number | null;
    totalMinutes: number | null;
}

export interface RecipeDetailDto extends RecipeListItemDto {
    description: string | null;
    instructions: string;
    ingredients: RecipeIngredientDto[];
}

export interface RecipeIngredientDto {
    ingredientId: string;
    name: string;
    amount: number | null;
    unit: Unit | null;
    note: string | null;
    groupLabel: string | null;
    position: number;
}