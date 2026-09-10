import { Transform, Type } from "class-transformer";
import { Unit } from "../../generated/prisma/client";
import { ArrayNotEmpty, IsArray, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Max, MaxLength, Min, ValidateNested } from "class-validator";

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

/** One line of the ingredient list. There is no `position` and no
`ingredientId`: the service takes the position from the array index and finds
or creates the ingredient by `name`, so each line reaches its ingredient one
way only. */
export class CreateRecipeIngredientDto {
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    name: string

    @IsOptional()
    @IsString()
    @MaxLength(80)
    note?: string

    @IsOptional()
    @IsString()
    @MaxLength(100)
    groupLabel?: string

    @IsOptional()
    @IsEnum(Unit)
    unit?: Unit;

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    @Max(9999)
    amount?: number
}


/** `sourceUrl`, `sourceName` and `externalId` are left out on purpose: they
belong to the V3 importer, and `forbidNonWhitelisted` answers 400 if a client
sends them. */
export class CreateRecipeDto {
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    title: string

    @IsInt()
    @Min(1)
    @IsOptional()
    servings?: number

    @IsOptional()
    @IsString()
    description?: string

    @IsOptional()
    @IsInt()
    @Min(1)
    prepMinutes?: number

    @IsOptional()
    @IsInt()
    @Min(1)
    totalMinutes?: number

    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString()
    @IsNotEmpty()
    instructions: string


    @IsArray()
    @ArrayNotEmpty()
    @ValidateNested({ each: true })
    @Type(() => CreateRecipeIngredientDto)
    ingredients: CreateRecipeIngredientDto[];
}
