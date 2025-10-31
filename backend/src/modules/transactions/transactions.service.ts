import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Account, Prisma, Transaction, TransactionStatus, TransactionType } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { UserContextService } from '../../common/services/user-context.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionsQueryDto } from './dto/transactions-query.dto';
import { TransactionEntity } from './entities/transaction.entity';
import { TransactionsListEntity } from './entities/transactions-list.entity';
import { AccountEntity } from '../accounts/entities/account.entity';

@Injectable()
export class TransactionsService {
  private readonly DEFAULT_LIMIT = 50;
  private readonly MAX_LIMIT = 200;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly userContext: UserContextService,
  ) {}

  async findMany(
    accountId: string,
    query: TransactionsQueryDto,
  ): Promise<TransactionsListEntity> {
    const userId = this.userContext.getUserId();
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    const skip = query.skip ?? 0;
    const take = Math.min(query.take ?? this.DEFAULT_LIMIT, this.MAX_LIMIT);

    const where: Prisma.TransactionWhereInput = {
      accountId: account.id,
    };

    if (query.from || query.to) {
      where.date = {};
      if (query.from) {
        (where.date as Prisma.DateTimeFilter).gte = new Date(query.from);
      }
      if (query.to) {
        (where.date as Prisma.DateTimeFilter).lte = new Date(query.to);
      }
    }

    if (query.search) {
      where.label = { contains: query.search, mode: 'insensitive' };
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.transactionType) {
      where.transactionType = query.transactionType;
    }

    const [items, total, ledger] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        orderBy: [
          { date: 'desc' },
          { createdAt: 'desc' },
        ],
        skip,
        take,
      }),
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where: { accountId: account.id },
        select: { id: true, amount: true, date: true, createdAt: true, transactionType: true },
        orderBy: [
          { date: 'asc' },
          { createdAt: 'asc' },
        ],
      }),
    ]);

    const runningBalanceMap = this.computeRunningBalances(
      ledger,
      Number(account.initialBalance),
    );

    const entities = items.map((tx) => this.toEntity(tx, runningBalanceMap.get(tx.id) ?? 0));

    return plainToInstance(TransactionsListEntity, {
      items: entities,
      meta: { total, skip, take },
    });
  }

  async create(accountId: string, dto: CreateTransactionDto): Promise<TransactionEntity> {
    const userId = this.userContext.getUserId();
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    if (dto.transactionType === TransactionType.INITIAL) {
      throw new BadRequestException('Les transactions initiales sont gérées automatiquement.');
    }

    if (dto.categoryId) {
      await this.ensureCategoryOwnership(dto.categoryId, userId);
    }

    if (dto.linkedTransactionId) {
      await this.ensureTransactionOwnership(dto.linkedTransactionId, userId);
    }

    const amount = new Prisma.Decimal(dto.amount);

    const { transaction, account: updatedAccount } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          accountId: account.id,
          categoryId: dto.categoryId,
          date: new Date(dto.date),
          label: dto.label,
          amount,
          status: dto.status ?? TransactionStatus.NONE,
          transactionType: dto.transactionType ?? TransactionType.NONE,
          linkedTransactionId: dto.linkedTransactionId ?? null,
        },
        include: { category: { select: { id: true, name: true } } },
      });

      const accountRecord = await this.recalculateAccountBalances(tx, account.id);

      return { transaction: created, account: accountRecord };
    });

    const runningMap = await this.recalculateRunningMap(account.id, Number(account.initialBalance));
    const entity = this.toEntity(transaction, runningMap.get(transaction.id) ?? 0);
    this.events.emit('transaction.created', entity);
    this.emitAccountUpdated(updatedAccount);
    return entity;
  }

  async findOne(accountId: string, transactionId: string): Promise<TransactionEntity> {
    const userId = this.userContext.getUserId();
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { category: { select: { id: true, name: true } } },
    });
    if (!transaction || transaction.accountId !== account.id) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    const runningMap = await this.recalculateRunningMap(account.id, Number(account.initialBalance));
    return this.toEntity(transaction, runningMap.get(transaction.id) ?? 0);
  }

  async update(
    accountId: string,
    transactionId: string,
    dto: UpdateTransactionDto,
  ): Promise<TransactionEntity> {
    const userId = this.userContext.getUserId();
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    const existing = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { category: true },
    });
    if (!existing || existing.accountId !== account.id) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    const isInitial = existing.transactionType === TransactionType.INITIAL;

    if (dto.categoryId !== undefined) {
      if (isInitial && dto.categoryId !== existing.categoryId) {
        throw new BadRequestException('La catégorie de la transaction initiale ne peut pas être modifiée.');
      }
      if (dto.categoryId) {
        await this.ensureCategoryOwnership(dto.categoryId, userId);
      }
    }

    if (dto.linkedTransactionId !== undefined) {
      if (isInitial && dto.linkedTransactionId !== existing.linkedTransactionId) {
        throw new BadRequestException('Les transactions initiales ne peuvent pas être liées.');
      }
      if (dto.linkedTransactionId) {
        await this.ensureTransactionOwnership(dto.linkedTransactionId, userId);
      }
    }

    if (dto.label !== undefined && isInitial && dto.label !== existing.label) {
      throw new BadRequestException('Le libellé de la transaction initiale ne peut pas être modifié.');
    }

    if (dto.transactionType !== undefined) {
      if (isInitial && dto.transactionType !== TransactionType.INITIAL) {
        throw new BadRequestException('Le type de la transaction initiale ne peut pas être modifié.');
      }
      if (!isInitial && dto.transactionType === TransactionType.INITIAL) {
        throw new BadRequestException('Impossible de définir une transaction initiale via cette API.');
      }
    }

    const newAmount = dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : existing.amount;

    const { transaction: updated, account: updatedAccount } = await this.prisma.$transaction(async (tx) => {
      const txn = await tx.transaction.update({
        where: { id: transactionId },
        data: {
          categoryId: dto.categoryId ?? existing.categoryId,
          date: dto.date ? new Date(dto.date) : existing.date,
          label: dto.label ?? existing.label,
          amount: newAmount,
          status: dto.status ?? existing.status,
          transactionType: dto.transactionType ?? existing.transactionType,
          linkedTransactionId:
            dto.linkedTransactionId !== undefined
              ? dto.linkedTransactionId
              : existing.linkedTransactionId,
        },
        include: { category: { select: { id: true, name: true } } },
      });
      const accountRecord = await this.recalculateAccountBalances(tx, account.id);

      return { transaction: txn, account: accountRecord };
    });

    const runningMap = await this.recalculateRunningMap(account.id, Number(account.initialBalance));
    const entity = this.toEntity(updated, runningMap.get(updated.id) ?? 0);
    this.events.emit('transaction.updated', entity);
    this.emitAccountUpdated(updatedAccount);
    return entity;
  }

  async remove(accountId: string, transactionId: string): Promise<TransactionEntity> {
    const userId = this.userContext.getUserId();
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    const existing = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { category: { select: { id: true, name: true } } },
    });
    if (!existing || existing.accountId !== account.id) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    if (existing.transactionType === TransactionType.INITIAL) {
      throw new BadRequestException('Les transactions initiales sont gérées automatiquement.');
    }

    const runningBefore = await this.recalculateRunningMap(
      account.id,
      Number(account.initialBalance),
    );
    const balance = runningBefore.get(existing.id) ?? 0;

    const updatedAccount = await this.prisma.$transaction(async (tx) => {
      await tx.transaction.delete({ where: { id: transactionId } });
      const accountRecord = await this.recalculateAccountBalances(tx, account.id);
      return accountRecord;
    });

    const entity = this.toEntity(existing, balance);
    this.events.emit('transaction.deleted', { accountId, transactionId });
    this.emitAccountUpdated(updatedAccount);
    return entity;
  }

  private async recalculateAccountBalances(
    client: Prisma.TransactionClient,
    accountId: string,
  ): Promise<Account> {
    const total = await client.transaction.aggregate({
      where: { accountId },
      _sum: { amount: true },
    });

    const pointed = await client.transaction.aggregate({
      where: {
        accountId,
        status: { in: [TransactionStatus.POINTED, TransactionStatus.RECONCILED] },
      },
      _sum: { amount: true },
    });

    const reconciled = await client.transaction.aggregate({
      where: { accountId, status: TransactionStatus.RECONCILED },
      _sum: { amount: true },
    });

    const account = await client.account.update({
      where: { id: accountId },
      data: {
        currentBalance: new Prisma.Decimal(total._sum.amount ?? 0),
        pointedBalance: new Prisma.Decimal(pointed._sum.amount ?? 0),
        reconciledBalance: new Prisma.Decimal(reconciled._sum.amount ?? 0),
      },
    });

    return account;
  }

  private emitAccountUpdated(account: Account | null) {
    if (!account) {
      return;
    }
    const entity = this.toAccountEntity(account);
    this.events.emit('account.updated', entity);
  }

  private toAccountEntity(account: Account): AccountEntity {
    return plainToInstance(AccountEntity, {
      ...account,
      initialBalance: Number(account.initialBalance),
      currentBalance: Number(account.currentBalance),
      pointedBalance: Number(account.pointedBalance),
      reconciledBalance: Number(account.reconciledBalance),
    });
  }

  private computeRunningBalances(
    ledger: Array<Pick<Transaction, 'id' | 'amount' | 'date' | 'createdAt' | 'transactionType'>>,
    initialBalance: number,
  ): Map<string, number> {
    const map = new Map<string, number>();
    let running = initialBalance;
    for (const entry of ledger) {
      if (entry.transactionType === TransactionType.INITIAL) {
        running = Number(entry.amount);
      } else {
        running += Number(entry.amount);
      }
      map.set(entry.id, running);
    }
    return map;
  }

  private async recalculateRunningMap(accountId: string, initialBalance: number) {
    const ledger = await this.prisma.transaction.findMany({
      where: { accountId },
      select: { id: true, amount: true, date: true, createdAt: true, transactionType: true },
      orderBy: [
        { date: 'asc' },
        { createdAt: 'asc' },
      ],
    });
    return this.computeRunningBalances(ledger, initialBalance);
  }

  private async ensureCategoryOwnership(categoryId: string, userId: string) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, userId },
      select: { id: true },
    });
    if (!category) {
      throw new NotFoundException(`Category ${categoryId} not found`);
    }
  }

  private async ensureTransactionOwnership(transactionId: string, userId: string) {
    const txn = await this.prisma.transaction.findFirst({
      where: {
        id: transactionId,
        account: { userId },
      },
      select: { id: true },
    });
    if (!txn) {
      throw new NotFoundException(`Linked transaction ${transactionId} not found`);
    }
  }

  private toEntity(
    transaction: Transaction & { category?: { id: string | null; name: string | null } | null },
    runningBalance: number,
  ): TransactionEntity {
    const amount = Number(transaction.amount);
    const debit = amount < 0 ? Math.abs(amount) : undefined;
    const credit = amount > 0 ? amount : undefined;

    return plainToInstance(TransactionEntity, {
      ...transaction,
      date: transaction.date.toISOString(),
      amount,
      debit,
      credit,
      balance: runningBalance,
      categoryId: transaction.category?.id ?? transaction.categoryId ?? null,
      categoryName: transaction.category?.name ?? null,
      status: transaction.status,
      transactionType: transaction.transactionType,
      linkedTransactionId: transaction.linkedTransactionId ?? null,
    });
  }
}
