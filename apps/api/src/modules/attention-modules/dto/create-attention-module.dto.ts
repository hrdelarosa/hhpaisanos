import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength } from 'class-validator';

export class CreateAttentionModuleDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/\S/u)
  @MaxLength(120)
  name!: string;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/\S/u)
  @MaxLength(100)
  municipality!: string;
}
