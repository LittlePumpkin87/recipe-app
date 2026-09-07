import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IngredientDto } from './dto/ingredient-response.dto';
import { ingredientSelect, toIngredient } from './ingredient.mapper';
import { normalizeIngredientName } from '../common/normalize-name';

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

}
