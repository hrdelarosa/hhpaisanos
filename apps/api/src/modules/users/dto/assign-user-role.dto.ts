import { IsUUID } from 'class-validator';
import { ResetUserPasswordDto } from './reset-user-password.dto.js';

export class AssignUserRoleDto extends ResetUserPasswordDto {
  @IsUUID('7')
  roleId!: string;
}
