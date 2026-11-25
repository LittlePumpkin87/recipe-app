import { Language, Unit } from '../generated/prisma/enums';
import {
    CreateRecipeIngredientDto,
    ImportRecipeInput,
} from '../recipes/dto/recipe.dto';
import { normalizeIngredientName } from '../common/normalize-name';

interface Unparsed {
    _unparsed: string;
}

export interface AllrecipesIngredient {
    ingredient: string;
    quantity: string;
    unit: string;
    misc: string;
}

export interface AllrecipesRecord {
    Name: string;
    'Preparation Time': string | null;
    'Cooking Time': string | null;
    Servings: number | string[] | Unparsed | null;
    Ingredients: AllrecipesIngredient[] | null;
    Ingredient_Names: string[][] | null;
    Ingredients_Raw: string[] | Unparsed | null;
    Instructions: string[] | Unparsed | null;
    URL: string | null;
}

const SOURCE_NAME = 'allrecipes';
const RECIPE_URL = /allrecipes\.com\/recipe\/(\d+)\//;
const INVALID_INGREDIENT_NAME = /^[-\d]/;

export function toImportRecipeInput(
    record: AllrecipesRecord,
    aliasIds: Map<string, string>,
): ImportRecipeInput | 'skipped' | 'unknown' {
    const title = record.Name.trim();
    const externalId = record.URL?.match(RECIPE_URL)?.[1];
    const rawLines = Array.isArray(record.Ingredients_Raw)
        ? record.Ingredients_Raw
        : [];
    if (
        !externalId ||
        title.length > 100 ||
        !Array.isArray(record.Instructions) ||
        record.Instructions.length === 0 ||
        !Array.isArray(record.Ingredients) ||
        record.Ingredients.length === 0 ||
        !Array.isArray(record.Ingredient_Names) ||
        record.Ingredients.some((ingredient, index) => {
            const name = ingredient.ingredient.trim();
            const rawLine = (rawLines[index] ?? '').trim();
            return (
                name === '' ||
                INVALID_INGREDIENT_NAME.test(name) ||
                (hasBrokenName(name) &&
                    (rawLine === '' || INVALID_INGREDIENT_NAME.test(rawLine)))
            );
        })
    ) {
        return 'skipped';
    }
    const ingredients = toImportIngredientLines(
        record.Ingredients,
        rawLines,
        record.Ingredient_Names,
        aliasIds,
    );
    if (ingredients === null) {
        return 'unknown';
    }
    const prepMinutes = toMinutes(record['Preparation Time']);
    const totalMinutes = prepMinutes + toMinutes(record['Cooking Time']);
    return {
        title,
        instructions: toNumberedList(record.Instructions),
        prepMinutes: prepMinutes > 0 ? prepMinutes : undefined,
        totalMinutes: totalMinutes > 0 ? totalMinutes : undefined,
        servings: toServings(record.Servings),
        ingredients,
        sourceName: SOURCE_NAME,
        externalId,
        sourceUrl: record.URL!,
        language: Language.EN,
    };
}

function toMinutes(value: string | null): number {
    const minutes = Number(value);
    return Number.isInteger(minutes) && minutes > 0 ? minutes : 0;
}

function toServings(value: AllrecipesRecord['Servings']): number | null {
    if (typeof value === 'number') {
        return value;
    }
    if (Array.isArray(value)) {
        const servings = Number(value[0]);
        return Number.isInteger(servings) && servings > 0 ? servings : null;
    }
    return null;
}

function toNumberedList(instructions: string[]): string {
    return instructions
        .map((instruction, index) => `${index + 1}. ${instruction.trim()}`)
        .join('\n');
}
//maps units from database to enums
const UNITS = new Map<string, Unit>([
    ['cup', Unit.CUP],
    ['cups', Unit.CUP],
    ['teaspoon', Unit.TEASPOON],
    ['teaspoons', Unit.TEASPOON],
    ['tsp', Unit.TEASPOON],
    ['tablespoon', Unit.TABLESPOON],
    ['tablespoons', Unit.TABLESPOON],
    ['tbsp', Unit.TABLESPOON],
    ['pound', Unit.POUND],
    ['pounds', Unit.POUND],
    ['lb', Unit.POUND],
    ['lbs', Unit.POUND],
    ['ounce', Unit.OUNCE],
    ['ounces', Unit.OUNCE],
    ['oz', Unit.OUNCE],
    ['quart', Unit.QUART],
    ['quarts', Unit.QUART],
    ['pint', Unit.PINT],
    ['pints', Unit.PINT],
    ['gram', Unit.GRAM],
    ['grams', Unit.GRAM],
    ['g', Unit.GRAM],
    ['kilogram', Unit.KILOGRAM],
    ['kilograms', Unit.KILOGRAM],
    ['kg', Unit.KILOGRAM],
    ['milliliter', Unit.MILLILITER],
    ['milliliters', Unit.MILLILITER],
    ['ml', Unit.MILLILITER],
    ['liter', Unit.LITER],
    ['liters', Unit.LITER],
    ['l', Unit.LITER],
    ['clove', Unit.CLOVE],
    ['cloves', Unit.CLOVE],
    ['pinch', Unit.PINCH],
    ['pinches', Unit.PINCH],
    ['dash', Unit.PINCH],
    ['dashes', Unit.PINCH],
    ['slice', Unit.SLICE],
    ['slices', Unit.SLICE],
    ['bunch', Unit.BUNCH],
    ['bunches', Unit.BUNCH],
    ['can', Unit.CAN],
    ['cans', Unit.CAN],
    ['package', Unit.PACK],
    ['packages', Unit.PACK],
    ['container', Unit.PACK],
    ['containers', Unit.PACK],
    ['jar', Unit.PACK],
    ['jars', Unit.PACK],
    ['bag', Unit.PACK],
    ['bags', Unit.PACK],
    ['packet', Unit.PACK],
    ['packets', Unit.PACK],
    ['envelope', Unit.PACK],
    ['envelopes', Unit.PACK],
    ['box', Unit.PACK],
    ['boxes', Unit.PACK],
    ['piece', Unit.PIECE],
    ['pieces', Unit.PIECE],
    ['whole', Unit.PIECE],
    ['bottle', Unit.BOTTLE],
    ['bottles', Unit.BOTTLE],
]);

const SIZE_WORDS = new Set([
    'large',
    'medium',
    'small',
    'head',
    'heads',
    'stalk',
    'stalks',
    'sprig',
    'sprigs',
]);

const NOTE_LENGTH = 80;
const RAW_INPUT = /^\S+ \(([^)]*)\) (\w+)/;
const FLUID_OUNCE_NAME = /^ounces? /;
const INGREDIENT_PREFIX = /^(and|or|to|into) /;

const ALTERNATIVE = /\bor\b/i;
const CAN = /\b(cans?|jars?)\b/i;
const FLAKES =
    /\b(crushed|teaspoons?|tablespoons?|tsp|tbsp|pinch(es)?|dash(es)?)\b/i;
const TO_TASTE = /\bto taste\b/i;

export function toImportIngredientLines(
    ingredients: AllrecipesIngredient[],
    rawLines: string[],
    ingredientNames: string[][],
    aliasIds: Map<string, string>,
): CreateRecipeIngredientDto[] | null {
    const lines: CreateRecipeIngredientDto[] = [];
    for (const [index, ingredient] of ingredients.entries()) {
        const rawLine = rawLines[index] ?? '';
        const rows = toIngredientRows(
            toIngredientLine(ingredient, rawLine),
            ingredientNames[index] ?? [],
            rawLine,
            aliasIds,
        );
        if (rows === null) {
            return null;
        }
        lines.push(...rows);
    }
    return lines;
}

function toIngredientRows(
    line: CreateRecipeIngredientDto,
    names: string[],
    rawLine: string,
    aliasIds: Map<string, string>,
): CreateRecipeIngredientDto[] | null {
    if (ALTERNATIVE.test(rawLine) && names.length > 1) {
        const alias = toKnownAlias(names[0], rawLine, aliasIds);
        if (alias === undefined) {
            return null;
        }
        const alternatives = `or ${names.slice(1).join(' or ')}`;
        return [
            {
                ...line,
                name: alias,
                note: toNote(
                    [alternatives, line.note].filter(Boolean).join(', '),
                ),
            },
        ];
    }
    const rows: CreateRecipeIngredientDto[] = [];
    for (const [index, name] of names.entries()) {
        const alias = toKnownAlias(name, rawLine, aliasIds);
        if (alias === undefined) {
            return null;
        }
        rows.push(
            index === 0
                ? { ...line, name: alias }
                : { name: alias, note: line.note },
        );
    }
    return rows.length > 0 ? rows : null;
}

function toKnownAlias(
    name: string,
    rawLine: string,
    aliasIds: Map<string, string>,
): string | undefined {
    let alias = normalizeIngredientName(name);
    if (alias === 'red pepper') {
        alias = FLAKES.test(rawLine) ? 'red pepper flakes' : 'red bell pepper';
    }
    if (CAN.test(rawLine) && aliasIds.has(`canned ${alias}`)) {
        return `canned ${alias}`;
    }
    return aliasIds.has(alias) ? alias : undefined;
}

//fetch if an ingredient is a whole sentence like "salt and pepper to taste" or similar
function hasBrokenName(name: string): boolean {
    return INGREDIENT_PREFIX.test(name) || name.includes('to taste');
}
//fetch correct segments for units and amount per ingredient line
function toLineWithoutUnit(
    name: string,
    amount: number | undefined,
    misc: string,
    rawLine: string,
): CreateRecipeIngredientDto {
    const match = RAW_INPUT.exec(rawLine);
    const unit = match ? UNITS.get(match[2].toLowerCase()) : undefined;
    if (match && unit) {
        const size = match[1];
        const brokenSize = size.replace(/[./]/g, '');
        return {
            name,
            amount,
            unit: amount === undefined ? undefined : unit,
            note: toNote(`${size} ${misc.replace(brokenSize, '')}`),
        };
    }
    return {
        name,
        amount,
        unit: amount === undefined ? undefined : Unit.PIECE,
        note: toNote(misc),
    };
}

function toIngredientLine(
    ingredient: AllrecipesIngredient,
    rawLine: string,
): CreateRecipeIngredientDto {
    const word = ingredient.unit.trim().toLowerCase();
    const name = ingredient.ingredient.trim();
    const misc = ingredient.misc.trim();
    const amount = toAmount(ingredient.quantity);
    const unit = UNITS.get(word);

    if (hasBrokenName(name)) {
        return {
            name: rawLine.trim(),
            note: TO_TASTE.test(rawLine) ? 'to taste' : undefined,
        };
    }
    if (unit) {
        return { name, amount, unit, note: toNote(misc) };
    }
    if (word === 'fluid' && FLUID_OUNCE_NAME.test(name)) {
        return {
            name: name.replace(FLUID_OUNCE_NAME, ''),
            amount,
            unit: Unit.FLUID_OUNCE,
            note: toNote(misc),
        };
    }
    if (SIZE_WORDS.has(word)) {
        return {
            name,
            amount,
            unit: Unit.PIECE,
            note: toNote(`${word} ${misc}`),
        };
    }
    if (word === '') {
        return toLineWithoutUnit(name, amount, misc, rawLine);
    }

    return { name, amount, note: toNote(rawLine || misc) };
}

function toAmount(quantity: string): number | undefined {
    const [numerator, denominator] = quantity.split('/');
    const amount =
        denominator === undefined
            ? Number(numerator)
            : Number(numerator) / Number(denominator);
    return Number.isFinite(amount) && amount > 0 ? amount : undefined;
}

function toNote(text: string): string | undefined {
    const note = text.replace(/\s+/g, ' ').trim();
    if (note === '') {
        return undefined;
    }
    return note.length <= NOTE_LENGTH
        ? note
        : `${note.slice(0, NOTE_LENGTH - 1)}…`;
}
