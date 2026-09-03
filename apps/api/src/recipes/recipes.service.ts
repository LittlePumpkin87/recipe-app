import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { recipeIngredientInclude, recipeListSelect, toRecipeDetail, toRecipeListItem } from './recipes.mapper';
import { RecipeListItemDto, RecipeDetailDto } from './dto/recipe-response.dto';

/** Business logic for recipes, and the only place a database query for them
may live. The two read paths fetch deliberately different shapes: the list
never loads instructions or ingredients, so the overview stays small as the
recipe count grows. Both hand their rows to the mapper — a Prisma row must not
leave this class. */
@Injectable()
export class RecipesService {

  constructor(private readonly prisma: PrismaService) { }

  async findAll(): Promise<RecipeListItemDto[]> {
    const recipes = await this.prisma.recipe.findMany({
      select: recipeListSelect,
      orderBy: { title: 'asc' },
    });
    return recipes.map(toRecipeListItem);

  }

  async findOne(id: string): Promise<RecipeDetailDto> {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id },
      include: recipeIngredientInclude
    });

    if (recipe === null) {
      throw new NotFoundException(`No Recipe found with id ${id}`)
    }
    return toRecipeDetail(recipe)
  }
}
