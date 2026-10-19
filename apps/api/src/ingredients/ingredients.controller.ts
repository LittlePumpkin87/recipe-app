import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { IngredientsService } from './ingredients.service';
import { CreateIngredientDto, IngredientDto } from './dto/ingredient.dto';

/** Maps the /ingredients endpoints onto IngredientsService. */
@Controller('ingredients')
export class IngredientsController {
    constructor(private readonly ingredientsService: IngredientsService) {}

    @Get()
    findAll(@Query('search') search?: string): Promise<IngredientDto[]> {
        return this.ingredientsService.findAll(search);
    }

    @Post()
    create(@Body() dto: CreateIngredientDto): Promise<IngredientDto> {
        return this.ingredientsService.create(dto);
    }
}
