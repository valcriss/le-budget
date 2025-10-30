import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryEntity } from './entities/category.entity';

@ApiTags('categories')
@ApiBearerAuth('access-token')
@Controller('categories')
@UseInterceptors(ClassSerializerInterceptor)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ApiOperation({ summary: 'Créer une catégorie', description: "Ajoute une nouvelle catégorie ou sous-catégorie pour l'utilisateur." })
  @ApiCreatedResponse({ type: CategoryEntity })
  create(@Body() dto: CreateCategoryDto): Promise<CategoryEntity> {
    return this.categoriesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les catégories', description: "Retourne toutes les catégories de l'utilisateur classées par ordre d'affichage." })
  @ApiOkResponse({ type: [CategoryEntity] })
  findAll(): Promise<CategoryEntity[]> {
    return this.categoriesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulter une catégorie', description: 'Récupère le détail d’une catégorie spécifique.' })
  @ApiOkResponse({ type: CategoryEntity })
  findOne(@Param('id') id: string): Promise<CategoryEntity> {
    return this.categoriesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour une catégorie', description: 'Modifie les informations d’une catégorie existante.' })
  @ApiOkResponse({ type: CategoryEntity })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryEntity> {
    return this.categoriesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer une catégorie', description: 'Supprime une catégorie dépourvue de sous-catégories.' })
  @ApiOkResponse({ type: CategoryEntity })
  remove(@Param('id') id: string): Promise<CategoryEntity> {
    return this.categoriesService.remove(id);
  }
}
