import { ApiProperty } from '@nestjs/swagger';
import { UserSettingsDto } from './user-settings.dto';

export class AuthUserDto {
  @ApiProperty({ description: 'Identifiant unique du compte', format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Adresse email du compte', example: 'user@example.com' })
  email!: string;

  @ApiProperty({
    description: "Nom d'affichage de l'utilisateur",
    example: 'Jean Dupont',
    nullable: true,
  })
  displayName!: string | null;

  @ApiProperty({
    description: 'Préférences utilisateur',
    type: UserSettingsDto,
  })
  settings!: UserSettingsDto;
}
