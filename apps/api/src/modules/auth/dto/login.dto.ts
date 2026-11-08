import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { CodePointLength, MaxUtf8Bytes } from './credential.validators.js';

export class LoginDto {
  @IsString()
  @Matches(/\S/u)
  @CodePointLength(1, 50)
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MaxUtf8Bytes(1024)
  password!: string;
}
