import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsString, Max, Min, ValidateIf } from 'class-validator';
import { CodePointLength } from '../../auth/dto/credential.validators.js';

const integer = (value: unknown) =>
  typeof value === 'string' && /^\d{1,8}$/.test(value) ? Number(value) : value;
const boolean = (value: unknown) => (value === 'true' ? true : value === 'false' ? false : value);

export class ListObserversQueryDto {
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
  @CodePointLength(1, 200)
  search?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => boolean(value))
  @IsBoolean()
  active?: boolean;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => boolean(value))
  @IsBoolean()
  linked?: boolean;
}
