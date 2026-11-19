import { readFileSync } from 'node:fs';
import { Language, Prisma } from '../generated/prisma/client';
import { normalizeIngredientName } from '../common/normalize-name';

type IngredientEntry = {
    en: string | null;
    enPlural: string | null;
    de: string | null;
    dePlural: string | null;
    aliases: { en: string[]; de: string[] };
};

/**
 * Writes the curated catalogue into `ingredient` and `ingredient_alias`.
 * Every display name becomes an alias in its language; safe to run repeatedly.
 */
export async function loadIngredients(
    tx: Prisma.TransactionClient,
    path: string,
): Promise<number> {
    const entries = JSON.parse(readFileSync(path, 'utf8')) as IngredientEntry[];

    for (const entry of entries) {
        const name = entry.en ?? entry.enPlural;
        if (name === null) {
            throw new Error(
                `Ingredient without a name: ${JSON.stringify(entry)}`,
            );
        }
        const key = normalizeIngredientName(name);

        const ingredient = await tx.ingredient.upsert({
            where: {
                nameNormalized_language: {
                    nameNormalized: key,
                    language: Language.EN,
                },
            },
            update: {
                nameEn: entry.en,
                nameDe: entry.de,
                nameEnPlural: entry.enPlural,
                nameDePlural: entry.dePlural,
            },
            create: {
                nameEn: entry.en,
                nameDe: entry.de,
                nameEnPlural: entry.enPlural,
                nameDePlural: entry.dePlural,
                nameNormalized: key,
                language: Language.EN,
            },
        });
        for (const data of [entry.en, entry.enPlural, ...entry.aliases.en]) {
            if (data === null) continue;
            const alias = normalizeIngredientName(data);
            await tx.ingredientAlias.upsert({
                where: { alias_language: { alias, language: Language.EN } },
                update: { ingredientId: ingredient.id },
                create: {
                    alias,
                    language: Language.EN,
                    ingredientId: ingredient.id,
                },
            });
        }
        for (const data of [entry.de, entry.dePlural, ...entry.aliases.de]) {
            if (data === null) continue;
            const alias = normalizeIngredientName(data);
            await tx.ingredientAlias.upsert({
                where: { alias_language: { alias, language: Language.DE } },
                update: { ingredientId: ingredient.id },
                create: {
                    alias,
                    language: Language.DE,
                    ingredientId: ingredient.id,
                },
            });
        }
    }
    return entries.length;
}
