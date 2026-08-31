import { Injectable } from '@nestjs/common';
import { Recipe } from '../generated/prisma/client';

/** Business logic for recipes, and the only place a database query for them
may live. findAll() returns a fixed empty array for now — replacing it with a
Prisma query will not touch the controller. */
@Injectable()
export class RecipesService {
  findAll(): Recipe[] {
    return [];
  }
}
