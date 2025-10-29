import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { AccountEntity } from './entities/account.entity';

@ApiTags('accounts')
@Controller('accounts')
@UseInterceptors(ClassSerializerInterceptor)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @ApiCreatedResponse({ type: AccountEntity })
  create(@Body() dto: CreateAccountDto): Promise<AccountEntity> {
    return this.accountsService.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: [AccountEntity] })
  findAll(): Promise<AccountEntity[]> {
    return this.accountsService.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ type: AccountEntity })
  findOne(@Param('id') id: string): Promise<AccountEntity> {
    return this.accountsService.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: AccountEntity })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ): Promise<AccountEntity> {
    return this.accountsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOkResponse({ type: AccountEntity })
  remove(@Param('id') id: string): Promise<AccountEntity> {
    return this.accountsService.remove(id);
  }
}
