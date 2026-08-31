import { Module } from '@nestjs/common';
import { RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';

/** Wires the recipe endpoints together: the controller is bound to routes at
startup, the service is injectable inside this module. Nothing is exported —
no other module needs RecipesService yet. */
@Module({
  controllers: [RecipesController],
  providers: [RecipesService],
})
export class RecipesModule {}
