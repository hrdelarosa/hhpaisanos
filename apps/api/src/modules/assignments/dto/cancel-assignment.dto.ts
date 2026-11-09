import { IsInt, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class CancelAssignmentDto {
  @IsString()
  @Matches(/\S/u)
  @MaxLength(500)
  reason!: string;

  @IsInt()
  @Min(1)
  @Max(4294967295)
  expectedVersion!: number;
}
