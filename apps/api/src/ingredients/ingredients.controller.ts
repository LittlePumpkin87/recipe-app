import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { IngredientsService } from './ingredients.service';
import { CreateIngredientDto, IngredientDto } from './dto/ingredient.dto';

/** Maps the /ingredients HTTP endpoints onto IngredientsService. In V1 they
serve the recipe form: GET feeds the autocomplete that steers users to an
existing ingredient, POST creates a new one and answers 409 if it exists after
all. */
@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredientService: IngredientsService) { }

  @Get()
  findAll(@Query('search') search?: string): Promise<IngredientDto[]> {
    return this.ingredientService.findAll(search);
  }

  @Post()
  create(@Body() dto: CreateIngredientDto): Promise<IngredientDto> {
    return this.ingredientService.create(dto);
  }

}