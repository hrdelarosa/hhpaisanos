import { IsUUID } from 'class-validator';

export class ObserverIdParamDto {
  @IsUUID('7')
  id!: string;
}
