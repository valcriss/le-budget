import { PartialType } from '@nestjs/mapped-types';
import { CreateBudgetCategoryDto } from './create-budget-category.dto';

export class UpdateBudgetCategoryDto extends PartialType(CreateBudgetCategoryDto) {}
