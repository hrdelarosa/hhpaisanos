import { Type } from 'class-transformer';
import { IsIn, IsInt, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export class ListOperativesQueryDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(120)
  name?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(['borrador', 'activo', 'cerrado'])
  status?: 'borrador' | 'activo' | 'cerrado';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
