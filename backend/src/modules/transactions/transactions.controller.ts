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
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  @ApiOperation({
    summary: 'Lister les transactions',
    description: 'Retourne la liste paginée des transactions pour un compte donné, filtrable par période ou type.',
  })
  @ApiOkResponse({ type: TransactionsListEntity })
  findMany(
    @Param('accountId') accountId: string,
    @Query() query: TransactionsQueryDto,
  ): Promise<TransactionsListEntity> {
    return this.transactionsService.findMany(accountId, query);
  }

  @Get(':transactionId')
  @ApiOperation({
    summary: 'Consulter une transaction',
    description: 'Récupère le détail d’une transaction spécifique appartenant au compte.',
  })
  @ApiOkResponse({ type: TransactionEntity })
  findOne(
    @Param('accountId') accountId: string,
    @Param('transactionId') transactionId: string,
  ): Promise<TransactionEntity> {
    return this.transactionsService.findOne(accountId, transactionId);
  }

  @Post()
  @ApiOperation({
    summary: 'Créer une transaction',
    description: 'Crée une nouvelle transaction et met à jour les soldes du compte associé.',
  })
  @ApiCreatedResponse({ type: TransactionEntity })
  create(
    @Param('accountId') accountId: string,
    @Body() dto: CreateTransactionDto,
  ): Promise<TransactionEntity> {
    return this.transactionsService.create(accountId, dto);
  }

  @Patch(':transactionId')
  @ApiOperation({
    summary: 'Mettre à jour une transaction',
    description: 'Modifie une transaction existante et répercute les changements sur le solde du compte.',
  })
  @ApiOkResponse({ type: TransactionEntity })
  update(
    @Param('accountId') accountId: string,
    @Param('transactionId') transactionId: string,
    @Body() dto: UpdateTransactionDto,
  ): Promise<TransactionEntity> {
    return this.transactionsService.update(accountId, transactionId, dto);
  }

  @Delete(':transactionId')
  @ApiOperation({
    summary: 'Supprimer une transaction',
    description: 'Supprime une transaction puis recalcule le solde courant du compte.',
  })
  @ApiOkResponse({ type: TransactionEntity })
  remove(
    @Param('accountId') accountId: string,
    @Param('transactionId') transactionId: string,
  ): Promise<TransactionEntity> {
    return this.transactionsService.remove(accountId, transactionId);
  }
}
