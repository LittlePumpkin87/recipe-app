import { Controller, Get, Query } from '@nestjs/common';
import { IngredientsService } from './ingredients.service';
import { IngredientDto } from './dto/ingredient-response.dto';

/** Maps the /ingredients HTTP endpoints onto IngredientsService. In V1 these
serve the autocomplete in the recipe form, which is what keeps duplicate
ingredients out of the database. */
@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredientService: IngredientsService) { }

  @Get()
  findAll(@Query('search') search?: string): Promise<IngredientDto[]> {
    return this.ingredientService.findAll(search);
  }
}