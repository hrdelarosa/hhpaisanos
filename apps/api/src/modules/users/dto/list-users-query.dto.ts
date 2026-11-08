import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsString, IsUUID, Max, Min, ValidateIf } from 'class-validator';
import { CodePointLength } from '../../auth/dto/credential.validators.js';

// Reject arrays, blanks and implicit boolean/number coercions at the HTTP boundary.
const integer = (value: unknown) =>
  typeof value === 'string' && /^\d{1,8}$/.test(value) ? Number(value) : value;

export class ListUsersQueryDto {
  @Transform(({ value }) => integer(value))
  @IsInt()
  @Min(1)
  @Max(1000000)
  page = 1;

  @Transform(({ value }) => integer(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @CodePointLength(1, 150)
  search?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  active?: boolean;

  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID('7')
  roleId?: string;
}
