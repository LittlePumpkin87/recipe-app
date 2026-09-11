import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { recipeIngredientInclude, recipeListSelect, toRecipeDetail, toRecipeListItem } from './recipes.mapper';
import { RecipeListItemDto, RecipeDetailDto, CreateRecipeDto } from './dto/recipe.dto';
import { normalizeIngredientName } from '../common/normalize-name';

/** Business logic for recipes, and the only place a database query for them
may live. The two read paths fetch deliberately different shapes: the list
never loads instructions or ingredients, so the overview stays small as the
recipe count grows. Every method hands its rows to the mapper — a Prisma row
must not leave this class. */
@Injectable()
export class RecipesService {

  constructor(private readonly prisma: PrismaService) { }

  async findAll(search?: string): Promise<RecipeListItemDto[]> {
    const searchTerm = search?.trim();
    const recipes = await this.prisma.recipe.findMany({
      where: {
        title: searchTerm ? { contains: searchTerm, mode: 'insensitive', } : undefined
      },
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


  /** Every write goes through `transactionClient`, so a failure anywhere rolls back the
  ingredients created along the way as well. Ingredients are resolved by
  normalized name before the recipe is written; a name that appears twice in
  the list is looked up once. The mapper runs only after the commit. */
  async create(dto: CreateRecipeDto): Promise<RecipeDetailDto> {
    const recipe = await this.prisma.$transaction(async (transactionClient) => {
      const ingredientIds = new Map<string, string>();

      for (const item of dto.ingredients) {
        const key = normalizeIngredientName(item.name);
        if (ingredientIds.has(key)) {
          continue;
        }
        const ingredient = await transactionClient.ingredient.upsert({
          where: { nameNormalized: key },
          update: {},
          create: { name: item.name, nameNormalized: key },
        });
        ingredientIds.set(key, ingredient.id);
      }

      return transactionClient.recipe.create({
        data: {
          title: dto.title,
          description: dto.description,
          instructions: dto.instructions,
          servings: dto.servings,
          prepMinutes: dto.prepMinutes,
          totalMinutes: dto.totalMinutes,
          recipeIngredients: {
            create: dto.ingredients.map((item, index) => ({
              ingredientId: ingredientIds.get(normalizeIngredientName(item.name))!,
              position: index + 1,
              amount: item.amount,
              groupLabel: item.groupLabel,
              unit: item.unit,
              note: item.note,
            })),
          },
        },
        include: recipeIngredientInclude,
      });
    });

    return toRecipeDetail(recipe);
  }
}