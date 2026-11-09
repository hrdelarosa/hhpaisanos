import { IsUUID } from 'class-validator';

export class AttentionModuleIdParamDto {
  @IsUUID('7')
  id!: string;
}
