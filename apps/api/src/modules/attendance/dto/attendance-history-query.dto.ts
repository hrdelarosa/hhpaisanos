import { Transform } from 'class-transformer';
import { IsInt, Max, Min, ValidateIf } from 'class-validator';
import { CivilDate } from '../../assignments/dto/assignment.validators.js';

const integer = (value: unknown) =>
  typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;

export class AttendanceHistoryQueryDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @CivilDate()
  from?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @CivilDate()
  to?: string;

  @Transform(({ value }: { value: unknown }) => integer(value))
  @IsInt()
  @Min(1)
  @Max(1000000)
  page = 1;

  @Transform(({ value }: { value: unknown }) => integer(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
