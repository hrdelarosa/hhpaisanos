import { IsNotEmpty, IsString } from 'class-validator';
import { CodePointLength, MaxUtf8Bytes } from './credential.validators.js';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxUtf8Bytes(1024)
  currentPassword!: string;

  @IsString()
  @CodePointLength(15, 128)
  newPassword!: string;
}
