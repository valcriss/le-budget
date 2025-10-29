import { PartialType } from '@nestjs/mapped-types';
import { CreateBudgetGroupDto } from './create-budget-group.dto';

export class UpdateBudgetGroupDto extends PartialType(CreateBudgetGroupDto) {}
