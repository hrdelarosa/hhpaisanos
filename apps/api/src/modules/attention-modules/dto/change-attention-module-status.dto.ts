import { IsBoolean, IsString, Matches, MaxLength } from 'class-validator';

export class ChangeAttentionModuleStatusDto {
  @IsBoolean()
  active!: boolean;

  @IsString()
  @Matches(/\S/u)
  @MaxLength(500)
  reason!: string;
}
