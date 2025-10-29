import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    description: 'Adresse email utilisée comme identifiant de connexion',
    example: 'user@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Mot de passe du nouvel utilisateur (minimum 8 caractères)',
    minLength: 8,
    example: 'S3cretP@ssword!',
  })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({
    description: 'Nom affiché pour l’utilisateur',
    example: 'Jean Dupont',
  })
  @IsOptional()
  @IsString()
  displayName?: string | null;
}
