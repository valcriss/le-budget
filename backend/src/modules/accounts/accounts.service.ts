import { Injectable, NotFoundException } from '@nestjs/common';
import { AccountType, Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { AccountEntity } from './entities/account.entity';
import { UserContextService } from '../../common/services/user-context.service';

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly userContext: UserContextService,
  ) {}

  async create(dto: CreateAccountDto): Promise<AccountEntity> {
    const userId = this.userContext.getUserId();
    const initial = dto.initialBalance ?? 0;

    const account = await this.prisma.account.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type ?? AccountType.CHECKING,
        institution: dto.institution,
        currency: (dto.currency ?? 'EUR').toUpperCase(),
        archived: dto.archived ?? false,
        initialBalance: new Prisma.Decimal(initial),
        currentBalance: new Prisma.Decimal(initial),
      },
    });

    const entity = this.toEntity(account);
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
      institution: dto.institution ?? existing.institution,
      currency: dto.currency ? dto.currency.toUpperCase() : existing.currency,
      archived: dto.archived ?? existing.archived,
    };

    if (dto.initialBalance !== undefined) {
      const diff = new Prisma.Decimal(dto.initialBalance).minus(existing.initialBalance);
      data.initialBalance = new Prisma.Decimal(dto.initialBalance);
      data.currentBalance = {
        increment: diff,
      };
    }

    const account = await this.prisma.account.update({
      where: { id },
      data,
    });

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
    });
  }
}
