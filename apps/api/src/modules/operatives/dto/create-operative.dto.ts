import { Transform } from 'class-transformer';
import { IsDateString, IsString, Matches, MaxLength } from 'class-validator';

export class CreateOperativeDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/\S/u)
  @MaxLength(120)
  name!: string;

  @IsDateString({ strict: true })
  @Matches(/^[1-9]\d{3}-\d{2}-\d{2}$/)
  startDate!: string;

  @IsDateString({ strict: true })
  @Matches(/^[1-9]\d{3}-\d{2}-\d{2}$/)
  endDate!: string;
}
