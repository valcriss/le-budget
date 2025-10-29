import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionsQueryDto } from './dto/transactions-query.dto';
import { TransactionsListEntity } from './entities/transactions-list.entity';
import { TransactionEntity } from './entities/transaction.entity';

@ApiTags('transactions')
@ApiBearerAuth('access-token')
@Controller('accounts/:accountId/transactions')
@UseInterceptors(ClassSerializerInterceptor)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @ApiOkResponse({ type: TransactionsListEntity })
  findMany(
    @Param('accountId') accountId: string,
    @Query() query: TransactionsQueryDto,
  ): Promise<TransactionsListEntity> {
    return this.transactionsService.findMany(accountId, query);
  }

  @Get(':transactionId')
  @ApiOkResponse({ type: TransactionEntity })
  findOne(
    @Param('accountId') accountId: string,
    @Param('transactionId') transactionId: string,
  ): Promise<TransactionEntity> {
    return this.transactionsService.findOne(accountId, transactionId);
  }

  @Post()
  @ApiCreatedResponse({ type: TransactionEntity })
  create(
    @Param('accountId') accountId: string,
    @Body() dto: CreateTransactionDto,
  ): Promise<TransactionEntity> {
    return this.transactionsService.create(accountId, dto);
  }

  @Patch(':transactionId')
  @ApiOkResponse({ type: TransactionEntity })
  update(
    @Param('accountId') accountId: string,
    @Param('transactionId') transactionId: string,
    @Body() dto: UpdateTransactionDto,
  ): Promise<TransactionEntity> {
    return this.transactionsService.update(accountId, transactionId, dto);
  }

  @Delete(':transactionId')
  @ApiOkResponse({ type: TransactionEntity })
  remove(
    @Param('accountId') accountId: string,
    @Param('transactionId') transactionId: string,
  ): Promise<TransactionEntity> {
    return this.transactionsService.remove(accountId, transactionId);
  }
}
