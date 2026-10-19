import { Transform, Type } from 'class-transformer';
import { Language, Unit } from '../../generated/prisma/client';
import {
    ArrayNotEmpty,
    IsArray,
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsPositive,
    IsString,
    Max,
    MaxLength,
    Min,
    ValidateIf,
    ValidateNested,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export interface RecipeListItemDto {
    id: string;
    title: string;
    servings: number | null;
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

/** What the importer hands to the service*/
export type ImportRecipeInput = Omit<CreateRecipeDto, 'servings'> & {
    servings: number | null;
    sourceName: string;
    sourceUrl: string;
    externalId: string;
    language: Language;
};

/** One line of the ingredient list. */
export class CreateRecipeIngredientDto {
    @Transform(({ value }) =>
        typeof value === 'string' ? value.trim() : value,
    )
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    name: string;

    @IsOptional()
    @IsString()
    @MaxLength(80)
    note?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    groupLabel?: string;

    @IsOptional()
    @IsEnum(Unit)
    unit?: Unit;

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    @Max(9999)
    amount?: number;
}

/** The body of `POST /recipes`. */
export class CreateRecipeDto {
    @Transform(({ value }) =>
        typeof value === 'string' ? value.trim() : value,
    )
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    title: string;

    @ValidateIf((_, value) => value !== undefined)
    @IsInt()
    @Min(1)
    servings?: number;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    prepMinutes?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    totalMinutes?: number;

    @Transform(({ value }) =>
        typeof value === 'string' ? value.trim() : value,
    )
    @IsString()
    @IsNotEmpty()
    instructions: string;

    @IsArray()
    @ArrayNotEmpty()
    @ValidateNested({ each: true })
    @Type(() => CreateRecipeIngredientDto)
    ingredients: CreateRecipeIngredientDto[];
}

/** The body of `PATCH /recipes/:id`, every field optional. */
export class UpdateRecipeDto extends PartialType(CreateRecipeDto, {
    skipNullProperties: false,
}) {}
