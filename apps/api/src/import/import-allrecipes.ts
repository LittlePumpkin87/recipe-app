import { NestFactory } from '@nestjs/core';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { AppModule } from '../app.module';
import { RecipesService } from '../recipes/recipes.service';
import { toImportRecipeInput, AllrecipesRecord } from './allrecipes.adapter';
import { Prisma } from '../generated/prisma/client';

const PROGRESS_STEP = 1000;

type Outcome = 'imported' | 'skipped' | 'duplicates' | 'failed';

async function importLine(
    recipesService: RecipesService,
    line: string,
): Promise<Outcome> {
    const input = toImportRecipeInput(JSON.parse(line) as AllrecipesRecord);
    if (input === null) {
        return 'skipped';
    }
    try {
        await recipesService.importRecipe(input);
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
    };
    let read = 0;

    try {
        const recipesService = app.get(RecipesService);
        const lines = createInterface({
            input: createReadStream(filePath),
            crlfDelay: Infinity,
        });

        for await (const line of lines) {
            if (line.trim() === '') {
                continue;
            }
            read++;
            counts[await importLine(recipesService, line)]++;

            if (read % PROGRESS_STEP === 0) {
                console.log(`${read} read`, counts);
            }
        }
    } finally {
        await app.close();
    }

    console.log(`Done, ${read} read`, counts);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
