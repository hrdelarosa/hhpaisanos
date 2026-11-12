import { IsObject, IsUUID } from 'class-validator';
import { CivilDate } from '../../assignments/dto/assignment.validators.js';
import type { PersonalMark } from '../attendance-input.js';

export class CaptureAttendanceDto {
  @IsUUID('7')
  assignmentId!: string;

  @CivilDate()
  expectedDate!: string;

  // The existing normalizer validates the exact available/missing-location union.
  @IsObject()
  location!: PersonalMark['location'];
}
