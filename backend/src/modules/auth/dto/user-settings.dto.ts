import { ApiProperty } from '@nestjs/swagger';

export class UserSettingsDto {
  @ApiProperty({
    description: 'Devise par défaut utilisée pour les comptes bancaires',
    example: 'EUR',
  })
  currency!: string;
}
