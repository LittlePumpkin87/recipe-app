import { Unit } from "../../generated/prisma/client";

export interface IngredientDto {
    id: string;
    defaultUnit: Unit | null;
    name: string;
}