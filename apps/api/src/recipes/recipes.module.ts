import { Module } from '@nestjs/common';
import { RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';

/** Wires the recipe controller and service together. */
@Module({
    controllers: [RecipesController],
    providers: [RecipesService],
})
export class RecipesModule {}
