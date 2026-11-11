import { IsInt, IsString, Matches, Max, Min } from 'class-validator';
import { CodePointLength } from '../../auth/dto/credential.validators.js';

export class ActivateOperativeDto {
  @IsString()
  @Matches(/\S/u)
  @CodePointLength(1, 500)
  reason!: string;

  @IsInt()
  @Min(0)
  @Max(65535)
  arrivalToleranceMinutes!: number;
}
