import { IsUUID } from 'class-validator';
import { CivilDate, ClockTime } from './assignment.validators.js';

export class CreateAssignmentDto {
  @IsUUID('7')
  operativeId!: string;

  @IsUUID('7')
  observerId!: string;

  @IsUUID('7')
  attentionModuleId!: string;

  @CivilDate()
  validFrom!: string;

  @CivilDate()
  validTo!: string;

  @ClockTime()
  startTime!: string;

  @ClockTime()
  endTime!: string;
}
