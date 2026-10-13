import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { recipeIngredientInclude, recipeListSelect, toRecipeDetail, toRecipeListItem } from './recipes.mapper';
import { RecipeListItemDto, RecipeDetailDto, CreateRecipeDto, CreateRecipeIngredientDto, UpdateRecipeDto, ImportRecipeInput } from './dto/recipe.dto';
import { normalizeIngredientName } from '../common/normalize-name';
import { Prisma } from '../generated/prisma/client';

/** Business logic and database queries for recipes. */
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

  /** Finds or creates each ingredient by normalized name; returns the ids keyed by that name. */
  private async resolveIngredientIds(
    transactionClient: Prisma.TransactionClient,
    ingredientLines: CreateRecipeIngredientDto[],
  ): Promise<Map<string, string>> {
    const ingredientIds = new Map<string, string>();

    for (const ingredientLine of ingredientLines) {
      const normalizedName = normalizeIngredientName(ingredientLine.name);
      if (ingredientIds.has(normalizedName)) {
        continue;
      }
      const ingredient = await transactionClient.ingredient.upsert({
        where: { nameNormalized: normalizedName },
        update: {},
        create: { name: ingredientLine.name, nameNormalized: normalizedName },
      });
      ingredientIds.set(normalizedName, ingredient.id);
    }
    return ingredientIds;
  }

  /** Builds the `data` for a recipe insert. */
  private buildRecipeCreateData(
    dto: Omit<CreateRecipeDto, 'servings'> & { servings?: number | null },
    ingredientIds: Map<string, string>,
  ): Prisma.RecipeCreateInput {
    return {
      title: dto.title,
      description: dto.description,
      instructions: dto.instructions,
      servings: dto.servings,
      prepMinutes: dto.prepMinutes,
      totalMinutes: dto.totalMinutes,
      recipeIngredients: {
        create: dto.ingredients.map((ingredientLine, index) => ({
          ingredientId: ingredientIds.get(normalizeIngredientName(ingredientLine.name))!,
          position: index + 1,
          amount: ingredientLine.amount,
          groupLabel: ingredientLine.groupLabel,
          unit: ingredientLine.unit,
          note: ingredientLine.note,
        })),
      },
    };
  }

  /** Creates a recipe with its ingredient list in one transaction. */
  async create(dto: CreateRecipeDto): Promise<RecipeDetailDto> {
    const recipe = await this.prisma.$transaction(async (transactionClient) => {
      const ingredientIds = await this.resolveIngredientIds(transactionClient, dto.ingredients);
      return transactionClient.recipe.create({
        data: this.buildRecipeCreateData(dto, ingredientIds),
        include: recipeIngredientInclude,
      });
    });

    return toRecipeDetail(recipe);
  }

  /** Writes one imported recipe and returns its id. */
  async importRecipe(input: ImportRecipeInput): Promise<string> {
    const recipe = await this.prisma.$transaction(async (transactionClient) => {
      const ingredientIds = await this.resolveIngredientIds(transactionClient, input.ingredients);
      return transactionClient.recipe.create({
        data: {
          ...this.buildRecipeCreateData(input, ingredientIds),
          sourceName: input.sourceName,
          externalId: input.externalId,
          sourceUrl: input.sourceUrl,
          language: input.language
        },
        select: { id: true }
      });
    });
    return recipe.id;
  }

  /** Updates the given fields; a present `ingredients` replaces the whole list. */
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
          }
        });
        if (dto.ingredients !== undefined) {
          const ingredientIds = await this.resolveIngredientIds(transactionClient, dto.ingredients);
          await transactionClient.recipeIngredient.deleteMany({ where: { recipeId: id } });
          await transactionClient.recipeIngredient.createMany({
            data: dto.ingredients.map((ingredientLine, index) => ({
              recipeId: id,
              ingredientId: ingredientIds.get(normalizeIngredientName(ingredientLine.name))!,
              position: index + 1,
              note: ingredientLine.note,
              amount: ingredientLine.amount,
              unit: ingredientLine.unit,
              groupLabel: ingredientLine.groupLabel
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


  /** Deletes a recipe together with its ingredient lines. */
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