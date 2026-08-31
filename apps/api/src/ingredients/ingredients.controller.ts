import { Controller, Get } from '@nestjs/common';
import { IngredientsService } from './ingredients.service';
import { Ingredient } from '../generated/prisma/client';

/** Maps the /ingredients HTTP endpoints onto IngredientsService. In V1 these
serve the autocomplete in the recipe form, which is what keeps duplicate
ingredients out of the database. */
@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredientService: IngredientsService) {}

  @Get()
  findAll(): Ingredient[] {
    return this.ingredientService.findAll();
  }
}
