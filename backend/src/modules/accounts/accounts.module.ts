import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { EventsModule } from '../events/events.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';

@Module({
  imports: [CommonModule, EventsModule, TransactionsModule],
  controllers: [AccountsController],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
