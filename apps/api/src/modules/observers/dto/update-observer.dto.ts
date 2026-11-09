import { IsString, Matches, ValidateIf } from 'class-validator';
import { CodePointLength } from '../../auth/dto/credential.validators.js';

export class UpdateObserverDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Matches(/\S/u)
  @CodePointLength(1, 100)
  firstNames?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Matches(/\S/u)
  @CodePointLength(1, 100)
  lastNames?: string;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @Matches(/\S/u)
  @CodePointLength(1, 20)
  phone?: string | null;

  @IsString()
  @Matches(/\S/u)
  @CodePointLength(1, 500)
  reason!: string;
}
