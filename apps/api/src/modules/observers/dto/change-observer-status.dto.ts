import { IsBoolean, IsString, Matches } from 'class-validator';
import { CodePointLength } from '../../auth/dto/credential.validators.js';

export class ChangeObserverStatusDto {
  @IsBoolean()
  active!: boolean;

  @IsString()
  @Matches(/\S/u)
  @CodePointLength(1, 500)
  reason!: string;
}
