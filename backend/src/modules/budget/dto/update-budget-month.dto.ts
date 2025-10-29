import { PartialType } from '@nestjs/mapped-types';
import { CreateBudgetMonthDto } from './create-budget-month.dto';

export class UpdateBudgetMonthDto extends PartialType(CreateBudgetMonthDto) {}
