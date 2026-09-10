import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIngredientDto, IngredientDto } from './dto/ingredient.dto';
import { ingredientSelect, toIngredient } from './ingredient.mapper';
import { normalizeIngredientName } from '../common/normalize-name';
import { Prisma } from '../generated/prisma/client';

/** Business logic for the central ingredient list, and the only place a
database query for it may live. Every comparison runs against `nameNormalized`
rather than the display name: that column was written by
`normalizeIngredientName`, so a search term has to pass through the same
function before the two can match. It is also why no `mode: 'insensitive'`
appears in this file — both sides are lowercase by the time they meet. Rows are
handed to the mapper; a Prisma row must not leave this class. */
@Injectable()
export class IngredientsService {

  constructor(private readonly prisma: PrismaService) { }


  async findAll(search?: string): Promise<IngredientDto[]> {
    const searchTerm = normalizeIngredientName(search ?? "")
    const ingredients = await this.prisma.ingredient.findMany({
      where: {
        nameNormalized: searchTerm ? { contains: searchTerm } : undefined
      },
      select: ingredientSelect,
      orderBy: { name: 'asc' },
      take: 20,
    });
    return ingredients.map(toIngredient);
  }

  /** Writes without checking for an existing row first: the unique index on
  `nameNormalized` decides, and its P2002 becomes a 409. A `findUnique` before
  the insert would leave a gap in which two requests both see "free". */
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
        throw new ConflictException(`An ingredient with the name "${dto.name}" allready exists`);
      }
      throw error;
    }
  }
}
