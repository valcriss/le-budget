import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Jeton de rafraîchissement précédemment émis',
    example: 'c0a8010c-1111-4f08-aaaa-8c7d4c3f2e97.5a8b97f5c3...',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
