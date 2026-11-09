import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';

const integer = (value: unknown) =>
  typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;

export class ListAttentionModulesQueryDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(120)
  name?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(100)
  municipality?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  active?: boolean;

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
