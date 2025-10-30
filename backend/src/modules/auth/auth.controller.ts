import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';
import { AuthTokenResponseDto } from './dto/auth-token-response.dto';
import { UserContextService } from '../../common/services/user-context.service';
import { AuthUserDto } from './dto/auth-user.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userContext: UserContextService,
  ) {}

  @Public()
  @ApiOperation({ summary: 'Créer un nouvel utilisateur' })
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponse({
    description: 'Jeton JWT pour la session du nouvel utilisateur',
    type: AuthTokenResponseDto,
  })
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthTokenResponseDto> {
    return this.authService.register(dto);
  }

  @Public()
  @ApiOperation({ summary: 'Authentifier un utilisateur existant' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description: 'Jeton JWT pour accéder aux endpoints protégés',
    type: AuthTokenResponseDto,
  })
  @Post('login')
  login(@Body() dto: LoginDto): Promise<AuthTokenResponseDto> {
    return this.authService.login(dto);
  }

  @Public()
  @ApiOperation({ summary: 'Renouveler un jeton d’accès à partir d’un refresh token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({
    description: 'Nouveaux jetons d’authentification',
    type: AuthTokenResponseDto,
  })
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokenResponseDto> {
    return this.authService.refresh(dto.refreshToken);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Récupérer le profil de l’utilisateur courant' })
  @ApiOkResponse({ description: 'Informations du compte authentifié', type: AuthUserDto })
  @Get('me')
  me(): Promise<AuthUserDto> {
    const userId = this.userContext.getUserId();
    return this.authService.getProfile(userId);
  }
}
