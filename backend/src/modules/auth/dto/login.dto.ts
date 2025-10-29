import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'Adresse email du compte',
    example: 'user@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Mot de passe du compte',
    minLength: 8,
    example: 'S3cretP@ssword!',
  })
  @IsString()
  @MinLength(8)
  password!: string;
}
