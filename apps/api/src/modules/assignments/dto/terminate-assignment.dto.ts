import { CivilDate } from './assignment.validators.js';
import { CancelAssignmentDto } from './cancel-assignment.dto.js';

export class TerminateAssignmentDto extends CancelAssignmentDto {
  @CivilDate()
  lastValidDate!: string;
}
