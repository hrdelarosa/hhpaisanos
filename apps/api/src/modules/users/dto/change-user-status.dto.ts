import { IsBoolean } from 'class-validator';
import { ResetUserPasswordDto } from './reset-user-password.dto.js';

export class ChangeUserStatusDto extends ResetUserPasswordDto {
  @IsBoolean()
  active!: boolean;
}
