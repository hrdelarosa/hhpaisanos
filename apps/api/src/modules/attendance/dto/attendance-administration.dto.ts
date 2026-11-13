import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateBy,
  ValidateIf,
} from 'class-validator';
import { CivilDate } from '../../assignments/dto/assignment.validators.js';
import { CodePointLength } from '../../auth/dto/credential.validators.js';
import { instantMicros } from '../attendance-time.js';
import { missingLocationReasons, type MissingLocationReason } from '../attendance-input.js';

export const reviewStatuses = [
  'accepted_automatic',
  'pending_review',
  'accepted_administrative',
  'rejected',
  'annulled',
] as const;
const integer = (value: unknown) =>
  typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;

function UtcInstant(): PropertyDecorator {
  return ValidateBy({
    name: 'utcAttendanceInstant',
    validator: {
      validate(value: unknown) {
        if (
          typeof value !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value)
        )
          return false;
        try {
          instantMicros(value.replace('T', ' ').slice(0, -1));
          return true;
        } catch {
          return false;
        }
      },
    },
  });
}

export class AttendanceIdParamDto {
  @IsUUID('7')
  id!: string;
}

export class AdministrativeAttendancePageDto {
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

export class AdministrativeAttendanceQueryDto extends AdministrativeAttendancePageDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUUID('7')
  operativeId?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUUID('7')
  moduleId?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUUID('7')
  observerId?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @CivilDate()
  from?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @CivilDate()
  to?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(reviewStatuses)
  reviewStatus?: (typeof reviewStatuses)[number];
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(['late_arrival', 'early_departure', 'missing_location'])
  anomaly?: 'late_arrival' | 'early_departure' | 'missing_location';
}

export class AttendanceReasonDto {
  @IsString()
  @Matches(/\S/u)
  @CodePointLength(1, 500)
  reason!: string;
}

export class AttendanceVersionDto extends AttendanceReasonDto {
  @IsInt()
  @Min(1)
  @Max(4294967295)
  expectedVersion!: number;
}

export class ReviewAttendanceDto extends AttendanceVersionDto {
  @IsIn(['accept', 'reject'])
  decision!: 'accept' | 'reject';
}

export class CorrectAttendanceDto extends AttendanceVersionDto {
  @UtcInstant()
  officialTimestamp!: string;
}

export class ManualAttendanceDto extends AttendanceReasonDto {
  @IsUUID('7')
  observerId!: string;
  @IsUUID('7')
  assignmentId!: string;
  @CivilDate()
  date!: string;
  @IsIn(['entrada', 'salida'])
  type!: 'entrada' | 'salida';
  @UtcInstant()
  officialTimestamp!: string;
  @IsIn(missingLocationReasons)
  missingLocationReason!: MissingLocationReason;
}
