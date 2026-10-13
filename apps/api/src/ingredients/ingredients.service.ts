import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIngredientDto, IngredientDto } from './dto/ingredient.dto';
import { ingredientSelect, toIngredient } from './ingredient.mapper';
import { normalizeIngredientName } from '../common/normalize-name';
import { Prisma } from '../generated/prisma/client';

/** Business logic and database queries for the central ingredient list. */
@Injectable()
export class IngredientsService {

  constructor(private readonly prisma: PrismaService) { }


  async findAll(search?: string): Promise<IngredientDto[]> {
    const normalizedSearch = normalizeIngredientName(search ?? "")
    const ingredients = await this.prisma.ingredient.findMany({
      where: {
        nameNormalized: normalizedSearch ? { contains: normalizedSearch } : undefined
      },
      select: ingredientSelect,
      orderBy: { name: 'asc' },
      take: 20,
    });
    return ingredients.map(toIngredient);
  }

  /** Creates an ingredient; a name that is taken becomes a 409. */
  async create(dto: CreateIngredientDto): Promise<IngredientDto> {
    try {
      const ingredient = await this.prisma.ingredient.create({
        data: {
          defaultUnit: dto.defaultUnit,
          name: dto.name,
          nameNormalized: normalizeIngredientName(dto.name),
        },
        select: ingredientSelect,
      });
      return toIngredient(ingredient);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`An ingredient with the name "${dto.name}" already exists`);
      }
      throw error;
    }
  }
}
