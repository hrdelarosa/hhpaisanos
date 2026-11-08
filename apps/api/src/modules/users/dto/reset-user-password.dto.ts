import { IsString, Matches } from 'class-validator';
import { CodePointLength } from '../../auth/dto/credential.validators.js';

export class ResetUserPasswordDto {
  @IsString()
  @Matches(/\S/u)
  @CodePointLength(1, 500)
  reason!: string;
}
