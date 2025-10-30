import { ApiProperty } from '@nestjs/swagger';
import { AuthUserDto } from './auth-user.dto';

export class AuthTokenResponseDto {
  @ApiProperty({
    description: 'Jeton JWT à utiliser dans le header Authorization',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'Jeton de rafraîchissement opaque à utiliser pour obtenir un nouveau jeton d’accès',
    example: 'c0a8010c-1111-4f08-aaaa-8c7d4c3f2e97.5a8b97f5c3...',
  })
  refreshToken!: string;

  @ApiProperty({ description: 'Informations du compte authentifié', type: AuthUserDto })
  user!: AuthUserDto;
}
