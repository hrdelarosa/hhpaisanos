import { IsUUID, ValidateIf } from 'class-validator';
import { CivilDate, ClockTime } from './assignment.validators.js';
import { CancelAssignmentDto } from './cancel-assignment.dto.js';

export class ChangeAssignmentDto extends CancelAssignmentDto {
  @CivilDate()
  effectiveFrom!: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUUID('7')
  attentionModuleId?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @ClockTime()
  startTime?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @ClockTime()
  endTime?: string;
}
