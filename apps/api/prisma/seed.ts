import { config } from "dotenv";
import { join } from "node:path";
config({ path: join(__dirname, "..", "..", "..", ".env") });

import { PrismaClient, Prisma, Unit } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { normalizeIngredientName } from "../src/common/normalize-name";

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] });
const prisma = new PrismaClient({ adapter });

// Types

type SeedIngredientLine = {
    name: string;
    amount?: string;
    unit?: Unit;
    note?: string;
    groupLabel?: string;
    defaultUnit?: Unit;
};

type SeedRecipe = {
    title: string;
    description?: string;
    instructions: string;
    servings: number;
    prepMinutes?: number;
    totalMinutes?: number;
    ingredients: SeedIngredientLine[];
};

// Data

const recipes: SeedRecipe[] = [
  {
    title: "Langos",
    servings: 3,
    instructions: [
      "1. Milch erwärmen (lauwarm), Zucker zugeben, Hefe hineinbröckeln und etwas aufgehen lassen.",
      "2. Eier, saure Sahne, Öl und Salz mischen, Milch-Hefe-Mischung und Mehl hinzugeben. Den Teig ca. 2 Stunden gehen lassen.",
      "3. Mit öligen Händen handtellergroße Fladen formen und in Öl ausbacken.",
      "4. Alle Zutaten für die Creme vermengen und durchziehen lassen.",
      "5. Langos mit der Creme bestreichen und nach Belieben mit Zwiebeln, Käse o. ä. belegen.",
    ].join("\n"),
    ingredients: [
      { name: "Milch", amount: "50", unit: "MILLILITER", groupLabel: "Für den Teig", defaultUnit: "MILLILITER" },
      { name: "Hefe", amount: "16", unit: "GRAM", note: "frisch", groupLabel: "Für den Teig", defaultUnit: "GRAM" },
      { name: "Zucker", amount: "1", unit: "PINCH", groupLabel: "Für den Teig", defaultUnit: "GRAM" },
      { name: "Ei", amount: "1", unit: "PIECE", groupLabel: "Für den Teig", defaultUnit: "PIECE" },
      { name: "Saure Sahne", amount: "1", unit: "PACK", groupLabel: "Für den Teig", defaultUnit: "PACK" },
      { name: "Öl", amount: "30", unit: "MILLILITER", groupLabel: "Für den Teig", defaultUnit: "MILLILITER" },
      { name: "Salz", amount: "1", unit: "TEASPOON", groupLabel: "Für den Teig", defaultUnit: "GRAM" },
      { name: "Mehl", amount: "330", unit: "GRAM", groupLabel: "Für den Teig", defaultUnit: "GRAM" },
      { name: "Öl", note: "zum Frittieren", groupLabel: "Für den Teig" },
      { name: "Saure Sahne", amount: "1", unit: "PACK", groupLabel: "Für die Knoblauchcreme" },
      { name: "Knoblauch", note: "viel", groupLabel: "Für die Knoblauchcreme", defaultUnit: "CLOVE" },
      { name: "Majo", amount: "1", unit: "TABLESPOON", groupLabel: "Für die Knoblauchcreme" },
      { name: "Kräuter", note: "nach Belieben", groupLabel: "Für die Knoblauchcreme" },
    ],
  },
  {
    title: "Römertopfbrot",
    description:
      "Der fertige Laib wiegt etwa 1,1 kg, das ergibt ca. 20 Scheiben à 55 g. Backzeit 1 Std., Ruhezeit 1 Std.",
    servings: 1,
    prepMinutes: 15,
    totalMinutes: 75,
    instructions: [
      "1. Das Wasser auf 37 Grad erwärmen und die Hefe darin auflösen.",
      "2. Alle Zutaten (Trockenhefe jetzt hinzufügen) dazugeben, dann zu einem klebrigen Teig verrühren.",
      "3. In eine bemehlte Schüssel füllen, 1 Std. gehen lassen. Dann den Teig ca. zehnmal falten, zu einem Laib formen und in einen gefetteten Römertopf oder ein ähnliches Gefäß mit Deckel geben.",
      "4. In den kalten Backofen stellen, bei 240 °C Ober-/Unterhitze 50 Min. mit Deckel backen, anschließend 10 Min. ohne Deckel weiterbacken.",
      "",
      "Anmerkung: Der Römertopf wird vor dem Backen nicht gewässert!",
    ].join("\n"),
    ingredients: [
      { name: "Wasser", amount: "520", unit: "MILLILITER", note: "lauwarm", defaultUnit: "MILLILITER" },
      { name: "Hefe", amount: "0.5", unit: "PACK", note: "oder 1 Päckchen Trockenhefe" },
      { name: "Weizenmehl Type 550", amount: "400", unit: "GRAM", defaultUnit: "GRAM" },
      { name: "Dinkelmehl Type 630", amount: "100", unit: "GRAM", defaultUnit: "GRAM" },
      { name: "Roggenmehl Type 1150", amount: "200", unit: "GRAM", defaultUnit: "GRAM" },
      { name: "Weizenmehl Type 1050", amount: "50", unit: "GRAM", defaultUnit: "GRAM" },
      { name: "Salz", amount: "3", unit: "TEASPOON", note: "gestrichen" },
      { name: "Zucker", amount: "1", unit: "TEASPOON", note: "gestrichen" },
      { name: "Fett", note: "für den Römertopf" },
    ],
  },
];


// Guard

function assertLocalDatabase(): void {
    const url = process.env["DATABASE_URL"];
    if (!url) {
        throw new Error("DATABASE_URL is not set.");
    }

    const host = new URL(url).hostname;
    if (host !== "localhost" && host !== "127.0.0.1") {
        throw new Error(`Refusing to seed a non-local database (host: ${host}).`);
    }
}

// Write steps

async function clearTables(tx: Prisma.TransactionClient): Promise<void> {
    await tx.recipeIngredient.deleteMany();
    await tx.recipe.deleteMany();
    await tx.ingredient.deleteMany();
}

async function seedIngredients(
    tx: Prisma.TransactionClient,
    data: SeedRecipe[],
): Promise<Map<string, string>> {
    const unique = new Map<string, SeedIngredientLine>();

    for (const recipe of data) {
        for (const line of recipe.ingredients) {
            const key = normalizeIngredientName(line.name);
            if (!unique.has(key)) {
                unique.set(key, line);
            }
        }
    }

    const ids = new Map<string, string>();

    for (const [key, line] of unique) {
        const ingredient = await tx.ingredient.upsert({
            where: { nameNormalized: key },
            update: {},
            create: {
                name: line.name.trim(),
                nameNormalized: key,
                defaultUnit: line.defaultUnit,
            },
        });

        ids.set(key, ingredient.id);
    }

    return ids;
}

async function seedRecipes(
    tx: Prisma.TransactionClient,
    data: SeedRecipe[],
    ingredientIds: Map<string, string>,
): Promise<void> {
    for (const recipe of data) {
        await tx.recipe.create({
            data: {
                title: recipe.title,
                description: recipe.description,
                instructions: recipe.instructions,
                servings: recipe.servings,
                prepMinutes: recipe.prepMinutes,
                recipeIngredients: {
                    create: recipe.ingredients.map((line, index) => {
                        const key = normalizeIngredientName(line.name);
                        const ingredientId = ingredientIds.get(key);

                        if (!ingredientId) {
                            throw new Error(`No ingredient row for "${key}".`);
                        }

                        return {
                            ingredientId,
                            position: index + 1,
                            amount: line.amount,
                            unit: line.unit,
                            note: line.note,
                            groupLabel: line.groupLabel,
                        };
                    }),
                },
            },
        });
    }
}

// Entry point

async function main(): Promise<void> {
    assertLocalDatabase();

    await prisma.$transaction(async (tx) => {
        await clearTables(tx);
        const ingredientIds = await seedIngredients(tx, recipes);
        await seedRecipes(tx, recipes, ingredientIds);

        console.log(`Seeded ${recipes.length} recipes, ${ingredientIds.size} ingredients.`);
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
