import { Injectable } from '@nestjs/common';
import { Ingredient } from '../generated/prisma/client';

/** Business logic for the central ingredient list. Name normalization and the
alias lookup that decides whether a name is a new ingredient or an existing one
will live here; findAll() returns a fixed empty array until then. */
@Injectable()
export class IngredientsService {
  findAll(): Ingredient[] {
    return [];
  }
}
