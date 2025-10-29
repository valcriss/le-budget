import { ApiProperty } from '@nestjs/swagger';
import { AuthUserDto } from './auth-user.dto';

export class AuthTokenResponseDto {
  @ApiProperty({
    description: 'Jeton JWT à utiliser dans le header Authorization',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({ description: 'Informations du compte authentifié', type: AuthUserDto })
  user!: AuthUserDto;
}
