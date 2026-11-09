import { IsString, Matches, ValidateIf } from 'class-validator';
import { CodePointLength } from '../../auth/dto/credential.validators.js';

export class CreateObserverDto {
  @IsString()
  @Matches(/\S/u)
  @CodePointLength(1, 100)
  firstNames!: string;

  @IsString()
  @Matches(/\S/u)
  @CodePointLength(1, 100)
  lastNames!: string;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @Matches(/\S/u)
  @CodePointLength(1, 20)
  phone?: string | null;
}
