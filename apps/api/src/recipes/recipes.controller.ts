import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { CreateRecipeDto, RecipeDetailDto, RecipeListItemDto } from './dto/recipe.dto';

/** Maps the /recipes HTTP endpoints onto RecipesService. Holds no
business logic: what a recipe is and where it comes from is the service's
concern, so a change of data source never reaches this file. */
@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) { }

  @Get()
  findAll(@Query('search') search?: string): Promise<RecipeListItemDto[]> {
    return this.recipesService.findAll(search);
  }

  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<RecipeDetailDto> {
    return this.recipesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateRecipeDto): Promise<RecipeDetailDto> {
    return this.recipesService.create(dto);
  }
}
