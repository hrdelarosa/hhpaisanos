import { IsUUID } from 'class-validator';

export class OperativeIdParamDto {
  @IsUUID('7')
  id!: string;
}
