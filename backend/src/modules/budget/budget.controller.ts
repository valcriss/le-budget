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
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { BudgetService } from './budget.service';
import { CreateBudgetMonthDto } from './dto/create-budget-month.dto';
import { UpdateBudgetMonthDto } from './dto/update-budget-month.dto';
import { CreateBudgetGroupDto } from './dto/create-budget-group.dto';
import { UpdateBudgetGroupDto } from './dto/update-budget-group.dto';
import { CreateBudgetCategoryDto } from './dto/create-budget-category.dto';
import { UpdateBudgetCategoryDto } from './dto/update-budget-category.dto';
import { BudgetMonthEntity } from './entities/budget-month.entity';
import { BudgetCategoryGroupEntity } from './entities/budget-group.entity';
import { BudgetCategoryEntity } from './entities/budget-category.entity';

@ApiTags('budget')
@Controller('budget')
@UseInterceptors(ClassSerializerInterceptor)
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  @Get('months')
  @ApiOkResponse({ type: [BudgetMonthEntity] })
  listMonths(): Promise<BudgetMonthEntity[]> {
    return this.budgetService.listMonths();
  }

  @Post('months')
  @ApiCreatedResponse({ type: BudgetMonthEntity })
  createMonth(@Body() dto: CreateBudgetMonthDto): Promise<BudgetMonthEntity> {
    return this.budgetService.createMonth(dto);
  }

  @Get('months/:monthKey')
  @ApiOkResponse({ type: BudgetMonthEntity })
  getMonth(@Param('monthKey') monthKey: string): Promise<BudgetMonthEntity> {
    return this.budgetService.getMonth(monthKey);
  }

  @Patch('months/:id')
  @ApiOkResponse({ type: BudgetMonthEntity })
  updateMonth(
    @Param('id') id: string,
    @Body() dto: UpdateBudgetMonthDto,
  ): Promise<BudgetMonthEntity> {
    return this.budgetService.updateMonth(id, dto);
  }

  @Post('months/:monthId/groups')
  @ApiCreatedResponse({ type: BudgetCategoryGroupEntity })
  createGroup(
    @Param('monthId') monthId: string,
    @Body() dto: CreateBudgetGroupDto,
  ): Promise<BudgetCategoryGroupEntity> {
    return this.budgetService.createGroup(monthId, dto);
  }

  @Patch('groups/:groupId')
  @ApiOkResponse({ type: BudgetCategoryGroupEntity })
  updateGroup(
    @Param('groupId') groupId: string,
    @Body() dto: UpdateBudgetGroupDto,
  ): Promise<BudgetCategoryGroupEntity> {
    return this.budgetService.updateGroup(groupId, dto);
  }

  @Delete('groups/:groupId')
  @ApiOkResponse({ type: BudgetCategoryGroupEntity })
  removeGroup(@Param('groupId') groupId: string): Promise<BudgetCategoryGroupEntity> {
    return this.budgetService.removeGroup(groupId);
  }

  @Post('groups/:groupId/categories')
  @ApiCreatedResponse({ type: BudgetCategoryEntity })
  createCategory(
    @Param('groupId') groupId: string,
    @Body() dto: CreateBudgetCategoryDto,
  ): Promise<BudgetCategoryEntity> {
    return this.budgetService.createCategory(groupId, dto);
  }

  @Patch('categories/:categoryId')
  @ApiOkResponse({ type: BudgetCategoryEntity })
  updateCategory(
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateBudgetCategoryDto,
  ): Promise<BudgetCategoryEntity> {
    return this.budgetService.updateCategory(categoryId, dto);
  }

  @Delete('categories/:categoryId')
  @ApiOkResponse({ type: BudgetCategoryEntity })
  removeCategory(@Param('categoryId') categoryId: string): Promise<BudgetCategoryEntity> {
    return this.budgetService.removeCategory(categoryId);
  }
}
