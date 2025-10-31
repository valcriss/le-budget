import { Injectable, NotFoundException } from '@nestjs/common';
import { AccountType, CategoryKind, Prisma, TransactionType } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { TransactionsService } from '../transactions/transactions.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { AccountEntity } from './entities/account.entity';
import { UserContextService } from '../../common/services/user-context.service';

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly transactions: TransactionsService,
    private readonly userContext: UserContextService,
  ) {}

  async create(dto: CreateAccountDto): Promise<AccountEntity> {
    const userId = this.userContext.getUserId();
    const initial = dto.initialBalance ?? 0;
    const reconciled = dto.reconciledBalance ?? initial;
    const settings = await this.prisma.userSettings.upsert({
      where: { userId },
      update: {},
      create: { userId },
      select: { currency: true },
    });
    const currency = (dto.currency ?? settings.currency ?? 'EUR').toUpperCase();

    const account = await this.prisma.account.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type ?? AccountType.CHECKING,
        currency,
        archived: dto.archived ?? false,
        initialBalance: new Prisma.Decimal(initial),
        currentBalance: new Prisma.Decimal(initial),
        reconciledBalance: new Prisma.Decimal(reconciled),
        pointedBalance: new Prisma.Decimal(initial),
      } as any,
    });

    const entity = this.toEntity(account);
    const initialCategoryId = await this.ensureInitialCategory(userId);
    await this.createTransferCategory(userId, account);
    await this.transactions.createInitialTransactionForAccount(account.id, {
      amount: initial,
      categoryId: initialCategoryId,
      label: 'Solde initial',
    });
    this.events.emit('account.created', entity);
    return entity;
  }

  async findAll(): Promise<AccountEntity[]> {
    const userId = this.userContext.getUserId();
    const accounts = await this.prisma.account.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return accounts.map((account) => this.toEntity(account));
  }

  async findOne(id: string): Promise<AccountEntity> {
    const userId = this.userContext.getUserId();
    const account = await this.prisma.account.findFirst({
      where: { id, userId },
    });
    if (!account) {
      throw new NotFoundException(`Account ${id} not found`);
    }
    return this.toEntity(account);
  }

  async update(id: string, dto: UpdateAccountDto): Promise<AccountEntity> {
    const userId = this.userContext.getUserId();
    const existing = await this.prisma.account.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException(`Account ${id} not found`);
    }

    const data: Prisma.AccountUpdateInput = {
      name: dto.name ?? existing.name,
      type: dto.type ?? existing.type,
      currency: dto.currency ? dto.currency.toUpperCase() : existing.currency,
      archived: dto.archived ?? existing.archived,
    };

    if (dto.initialBalance !== undefined) {
      const diff = new Prisma.Decimal(dto.initialBalance).minus(existing.initialBalance);
      data.initialBalance = new Prisma.Decimal(dto.initialBalance);
      data.currentBalance = {
        increment: diff,
      };
      (data as Prisma.AccountUncheckedUpdateInput as any).pointedBalance = {
        increment: diff,
      };
    }

    if (dto.reconciledBalance !== undefined) {
      data.reconciledBalance = new Prisma.Decimal(dto.reconciledBalance);
    }

    const account = await this.prisma.account.update({
      where: { id },
      data,
    });

    if (dto.initialBalance !== undefined) {
      await this.prisma.transaction.updateMany({
        where: { accountId: account.id, transactionType: TransactionType.INITIAL },
        data: { amount: new Prisma.Decimal(dto.initialBalance) },
      });
    }

    const entity = this.toEntity(account);
    this.events.emit('account.updated', entity);
    return entity;
  }

  async remove(id: string): Promise<AccountEntity> {
    const userId = this.userContext.getUserId();
    const existing = await this.prisma.account.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException(`Account ${id} not found`);
    }

    const account = await this.prisma.account.update({
      where: { id },
      data: { archived: true },
    });

    const entity = this.toEntity(account);
    this.events.emit('account.archived', entity);
    return entity;
  }

  private toEntity(account: { [key: string]: any }): AccountEntity {
    return plainToInstance(AccountEntity, {
      ...account,
      initialBalance: Number(account.initialBalance),
      currentBalance: Number(account.currentBalance),
      reconciledBalance: Number(account.reconciledBalance),
      pointedBalance: Number(account.pointedBalance),
    });
  }

  private async ensureInitialCategory(userId: string): Promise<string> {
    const existing = await this.prisma.category.findFirst({
      where: { userId, kind: CategoryKind.INITIAL },
      select: { id: true },
    });
    if (existing) {
      return existing.id;
    }

    const { _max } = await this.prisma.category.aggregate({
      where: { userId, parentCategoryId: null },
      _max: { sortOrder: true },
    });

    const category = await this.prisma.category.create({
      data: {
        userId,
        name: 'Solde initial',
        kind: CategoryKind.INITIAL,
        sortOrder: (_max.sortOrder ?? -1) + 1,
      },
    });
    return category.id;
  }

  private async createTransferCategory(userId: string, account: { id: string; name: string }) {
    const { _max } = await this.prisma.category.aggregate({
      where: { userId, parentCategoryId: null },
      _max: { sortOrder: true },
    });

    await this.prisma.category.create({
      data: {
        userId,
        name: `Virement ${account.name}`,
        kind: CategoryKind.TRANSFER,
        sortOrder: (_max.sortOrder ?? -1) + 1,
        linkedAccountId: account.id,
      },
    });
  }

}
