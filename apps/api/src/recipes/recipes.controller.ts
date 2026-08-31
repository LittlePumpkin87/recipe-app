import { Controller, Get } from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { Recipe } from '../generated/prisma/client';

/** Maps the /recipes HTTP endpoints onto RecipesService. Holds no
business logic: what a recipe is and where it comes from is the service's
concern, so a change of data source never reaches this file. */
@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Get()
  findAll(): Recipe[] {
    return this.recipesService.findAll();
  }
}
