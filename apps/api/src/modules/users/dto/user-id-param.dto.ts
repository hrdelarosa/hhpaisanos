import { IsUUID } from 'class-validator';

export class UserIdParamDto {
  @IsUUID('7')
  id!: string;
}
