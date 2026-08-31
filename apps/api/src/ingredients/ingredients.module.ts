import { Module } from '@nestjs/common';
import { IngredientsController } from './ingredients.controller';
import { IngredientsService } from './ingredients.service';

/** Wires the ingredient endpoints together. Nothing is exported yet — once
POST /recipes needs the ingredient lookup, IngredientsService is what this
module will have to export. */
@Module({
  controllers: [IngredientsController],
  providers: [IngredientsService],
})
export class IngredientsModule {}
