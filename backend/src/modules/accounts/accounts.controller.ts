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
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { AccountEntity } from './entities/account.entity';

@ApiTags('accounts')
@ApiBearerAuth('access-token')
@Controller('accounts')
@UseInterceptors(ClassSerializerInterceptor)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un compte', description: 'Ajoute un nouveau compte pour l’utilisateur courant.' })
  @ApiCreatedResponse({ type: AccountEntity })
  create(@Body() dto: CreateAccountDto): Promise<AccountEntity> {
    return this.accountsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les comptes', description: 'Retourne l’ensemble des comptes de l’utilisateur.' })
  @ApiOkResponse({ type: [AccountEntity] })
  findAll(): Promise<AccountEntity[]> {
    return this.accountsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulter un compte', description: 'Récupère le détail d’un compte par identifiant.' })
  @ApiOkResponse({ type: AccountEntity })
  findOne(@Param('id') id: string): Promise<AccountEntity> {
    return this.accountsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour un compte', description: 'Modifie les informations d’un compte existant.' })
  @ApiOkResponse({ type: AccountEntity })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ): Promise<AccountEntity> {
    return this.accountsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archiver un compte', description: 'Archive un compte au lieu de le supprimer définitivement.' })
  @ApiOkResponse({ type: AccountEntity })
  remove(@Param('id') id: string): Promise<AccountEntity> {
    return this.accountsService.remove(id);
  }
}
