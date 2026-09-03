import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { RecipeDetailDto, RecipeListItemDto } from './dto/recipe-response.dto';

/** Maps the /recipes HTTP endpoints onto RecipesService. Holds no
business logic: what a recipe is and where it comes from is the service's
concern, so a change of data source never reaches this file. */
@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) { }

  @Get()
  findAll(): Promise<RecipeListItemDto[]> {
    return this.recipesService.findAll();
  }

  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<RecipeDetailDto> {
    return this.recipesService.findOne(id);
  }
}
