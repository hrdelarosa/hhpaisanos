import { IsString, Matches } from 'class-validator';
import { CodePointLength } from '../../auth/dto/credential.validators.js';
import { ResetUserPasswordDto } from './reset-user-password.dto.js';

export class UpdateUserDto extends ResetUserPasswordDto {
  @IsString()
  @Matches(/\S/u)
  @CodePointLength(1, 150)
  fullName!: string;
}
