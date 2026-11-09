import { IsUUID } from 'class-validator';

export class AssignmentIdParamDto {
  @IsUUID('7')
  id!: string;
}
