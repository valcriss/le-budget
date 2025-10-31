import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { EventsModule } from '../events/events.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { BudgetController } from './budget.controller';
import { BudgetService } from './budget.service';

@Module({
  imports: [CommonModule, EventsModule, TransactionsModule],
  controllers: [BudgetController],
  providers: [BudgetService],
})
export class BudgetModule {}
