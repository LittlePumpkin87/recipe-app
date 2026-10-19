import { Module } from '@nestjs/common';
import { IngredientsController } from './ingredients.controller';
import { IngredientsService } from './ingredients.service';

/** Wires the ingredient controller and service together. */
@Module({
    controllers: [IngredientsController],
    providers: [IngredientsService],
})
export class IngredientsModule {}
