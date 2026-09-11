import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { recipeIngredientInclude, recipeListSelect, toRecipeDetail, toRecipeListItem } from './recipes.mapper';
import { RecipeListItemDto, RecipeDetailDto, CreateRecipeDto, CreateRecipeIngredientDto, UpdateRecipeDto } from './dto/recipe.dto';
import { normalizeIngredientName } from '../common/normalize-name';
import { Prisma } from '../generated/prisma/client';

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

  /** Finds or creates each ingredient by normalized name and returns the ids,
  keyed by that name. Takes the caller's `transactionClient`, so ingredients
  created here are rolled back with the rest; a name that appears twice in the
  list is looked up once. */
  private async resolveIngredientIds(
    transactionClient: Prisma.TransactionClient,
    recipeIngredients: CreateRecipeIngredientDto[],
  ): Promise<Map<string, string>> {
    const ingredientIds = new Map<string, string>();

    for (const item of recipeIngredients) {
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
    return ingredientIds;
  }

  /** Every write goes through `transactionClient`, so a failure anywhere rolls
  back the ingredients created along the way as well. The mapper runs only after
  the commit. */
  async create(dto: CreateRecipeDto): Promise<RecipeDetailDto> {
    const recipe = await this.prisma.$transaction(async (transactionClient) => {
      const ingredientIds = await this.resolveIngredientIds(transactionClient, dto.ingredients);
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

  /** Missing fields stay untouched; a present `ingredients` replaces the whole
  list. `updatedAt` is set by hand: with only `ingredients` in the request the
  data would be empty, Prisma would skip the UPDATE, and `@updatedAt` would not
  fire. The recipe update runs first so that an unknown id fails with P2025, a
  404, before anything is written — resolving ingredients first would end in a
  foreign-key error and a 500 instead. The catch wraps the whole transaction:
  caught inside, the error would let Prisma commit. */
  async update(id: string, dto: UpdateRecipeDto): Promise<RecipeDetailDto> {
    try {
      const recipe = await this.prisma.$transaction(async (transactionClient) => {
        await transactionClient.recipe.update({
          where: { id },
          data: {
            title: dto.title,
            description: dto.description,
            servings: dto.servings,
            totalMinutes: dto.totalMinutes,
            instructions: dto.instructions,
            prepMinutes: dto.prepMinutes,
            updatedAt: new Date(),
          }
        });
        if (dto.ingredients !== undefined) {
          const ingredientIds = await this.resolveIngredientIds(transactionClient, dto.ingredients);
          await transactionClient.recipeIngredient.deleteMany({ where: { recipeId: id } });
          await transactionClient.recipeIngredient.createMany({
            data: dto.ingredients.map((item, index) => ({
              recipeId: id,
              ingredientId: ingredientIds.get(normalizeIngredientName(item.name))!,
              position: index + 1,
              note: item.note,
              amount: item.amount,
              unit: item.unit,
              groupLabel: item.groupLabel
            })),
          });
        }
        return transactionClient.recipe.findUniqueOrThrow({
          where: { id },
          include: recipeIngredientInclude,
        });
      });
      return toRecipeDetail(recipe);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`No Recipe found with id ${id}`);
      }
      throw error;
    }
  }


  /** Deletes without looking first: a missing row surfaces as P2025 and becomes
  a 404. The join rows go with the recipe through `ON DELETE CASCADE`, inside
  the same statement, which is why no transaction is needed here; the
  ingredients themselves stay. */
  async remove(id: string): Promise<void> {
    try {
      await this.prisma.recipe.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`No recipe found with id ${id}`)
      }
      throw error;
    }
  }
}