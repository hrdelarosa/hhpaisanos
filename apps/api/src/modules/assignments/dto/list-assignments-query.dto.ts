import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsUUID, Max, Min, ValidateIf } from 'class-validator';
import { CivilDate } from './assignment.validators.js';

const integer = (value: unknown) =>
  typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;

export class ListAssignmentsQueryDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUUID('7')
  operativeId?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUUID('7')
  observerId?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUUID('7')
  attentionModuleId?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @CivilDate()
  applicableOn?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @CivilDate()
  from?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @CivilDate()
  to?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  cancelled?: boolean;

  @Transform(({ value }: { value: unknown }) => integer(value))
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  page = 1;

  @Transform(({ value }: { value: unknown }) => integer(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
