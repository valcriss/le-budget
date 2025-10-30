import { Body, ClassSerializerInterceptor, Controller, Get, Param, Patch, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { BudgetService } from './budget.service';
import { UpdateBudgetCategoryDto } from './dto/update-budget-category.dto';
import { BudgetMonthEntity } from './entities/budget-month.entity';
import { BudgetCategoryEntity } from './entities/budget-category.entity';

@ApiTags('budget')
@ApiBearerAuth('access-token')
@Controller('budget')
@UseInterceptors(ClassSerializerInterceptor)
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  @ApiOperation({
    summary: 'Récupérer les données budgétaires pour un mois donné',
    description:
      'Crée automatiquement le mois, les groupes parents et les lignes enfants manquants avant de retourner le snapshot complet.',
  })
  @ApiParam({
    name: 'monthKey',
    description: 'Identifiant du mois au format YYYY-MM',
    example: '2025-10',
  })
  @Get('months/:monthKey')
  @ApiOkResponse({ type: BudgetMonthEntity })
  getMonth(@Param('monthKey') monthKey: string): Promise<BudgetMonthEntity> {
    return this.budgetService.getMonth(monthKey);
  }

  @ApiOperation({
    summary: 'Mettre à jour une enveloppe budgétaire pour un mois donné',
    description:
      'Permet de modifier les montants assignés/activités pour la catégorie enfant correspondante. La structure est créée automatiquement si nécessaire.',
  })
  @ApiParam({
    name: 'monthKey',
    description: 'Identifiant du mois au format YYYY-MM',
    example: '2025-10',
  })
  @ApiParam({
    name: 'categoryId',
    description: 'Identifiant de la catégorie enfant à mettre à jour',
    example: 'cat-child-supermarche',
  })
  @ApiBody({ type: UpdateBudgetCategoryDto })
  @Patch('months/:monthKey/categories/:categoryId')
  @ApiOkResponse({ type: BudgetCategoryEntity })
  updateCategory(
    @Param('monthKey') monthKey: string,
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateBudgetCategoryDto,
  ): Promise<BudgetCategoryEntity> {
    return this.budgetService.updateCategory(monthKey, categoryId, dto);
  }

}
