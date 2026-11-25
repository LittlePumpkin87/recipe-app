import { NestFactory } from '@nestjs/core';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { AppModule } from '../app.module';
import { RecipesService } from '../recipes/recipes.service';
import { toImportRecipeInput, AllrecipesRecord } from './allrecipes.adapter';
import { Language, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { loadIngredients } from './load-ingredient-catalog';
import { join } from 'node:path';
import { Presets, SingleBar } from 'cli-progress';

type Outcome = 'imported' | 'skipped' | 'unknown' | 'duplicates' | 'failed';

async function importLine(
    recipesService: RecipesService,
    aliasIds: Map<string, string>,
    line: string,
): Promise<Outcome> {
    const input = toImportRecipeInput(
        JSON.parse(line) as AllrecipesRecord,
        aliasIds,
    );

    if (typeof input === 'string') {
        return input;
    }

    try {
        await recipesService.importRecipe(input, aliasIds);
        return 'imported';
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
        ) {
            return 'duplicates';
        }
        console.error(
            `Failed: ${input.sourceUrl}`,
            error instanceof Error ? error.message : error,
        );
        return 'failed';
    }
}

async function countLines(filePath: string): Promise<number> {
    let count = 0;
    const lines = createInterface({
        input: createReadStream(filePath),
        crlfDelay: Infinity,
    });
    for await (const line of lines) {
        if (line.trim() !== '') {
            count++;
        }
    }
    return count;
}

async function main(): Promise<void> {
    const filePath = process.argv[2];
    if (!filePath) {
        throw new Error(
            'No input file given. Usage: node dist/import/import-allrecipes.js <file.ndjson>',
        );
    }

    const app = await NestFactory.createApplicationContext(AppModule, {
        logger: ['error', 'warn'],
    });
    const counts: Record<Outcome, number> = {
        imported: 0,
        skipped: 0,
        duplicates: 0,
        failed: 0,
        unknown: 0,
    };
    let read = 0;

    try {
        const prisma = app.get(PrismaService);
        const catalogSize = await prisma.$transaction(
            (transactionClient) =>
                loadIngredients(
                    transactionClient,
                    join(
                        __dirname,
                        '..',
                        '..',
                        'prisma',
                        'ingredient-catalog.json',
                    ),
                ),
            { timeout: 60_000 },
        );
        console.log(`Loaded ${catalogSize} catalog entries`);
        const aliases = await prisma.ingredientAlias.findMany({
            where: { language: Language.EN },
            select: { alias: true, ingredientId: true },
        });
        const aliasIds = new Map(
            aliases.map((entry) => [entry.alias, entry.ingredientId]),
        );
        console.log(`Loaded ${aliasIds.size} aliases`);
        const recipesService = app.get(RecipesService);
        const bar = new SingleBar(
            {
                format: '{bar} {percentage}% | {value}/{total} | ETA {eta_formatted} | imported {imported}, unknown {unknown}',
            },
            Presets.shades_classic,
        );
        bar.start(await countLines(filePath), 0, counts);

        const lines = createInterface({
            input: createReadStream(filePath),
            crlfDelay: Infinity,
        });

        for await (const line of lines) {
            if (line.trim() === '') {
                continue;
            }
            read++;
            counts[await importLine(recipesService, aliasIds, line)]++;
            bar.increment(1, counts);
        }
        bar.stop();
    } finally {
        await app.close();
    }

    console.log(`Done, ${read} read`, counts);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
