import { IsString, IsUUID, Matches } from 'class-validator';
import { CodePointLength } from '../../auth/dto/credential.validators.js';

export class CreateUserDto {
  @IsString()
  @Matches(/\S/u)
  @CodePointLength(1, 50)
  username!: string;

  @IsString()
  @Matches(/\S/u)
  @CodePointLength(1, 150)
  fullName!: string;

  @IsUUID('7')
  roleId!: string;
}
