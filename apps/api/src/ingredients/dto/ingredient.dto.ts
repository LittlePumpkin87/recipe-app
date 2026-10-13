import { Unit } from "../../generated/prisma/client";

import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export interface IngredientDto {
    id: string;
    defaultUnit: Unit | null;
    name: string;
}

/** The body of `POST /ingredients`. */
export class CreateIngredientDto {
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    name: string;

    @IsOptional()
    @IsEnum(Unit)
    defaultUnit?: Unit;
}
