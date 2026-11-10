import { IsString } from 'class-validator';
import { CodePointLength } from '../../auth/dto/credential.validators.js';

export class LinkableAccountQueryDto {
  @IsString()
  @CodePointLength(1, 50)
  username!: string;
}
