import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';

export type LoginDto = { username: string; password: string };

@Injectable()
export class LoginPipe implements PipeTransform<unknown, LoginDto> {
  transform(value: unknown): LoginDto {
    if (!value || typeof value !== 'object')
      throw new BadRequestException('Invalid credentials input');
    const { username, password } = value as Record<string, unknown>;
    if (
      typeof username !== 'string' ||
      !username.trim() ||
      Array.from(username).length > 50 ||
      typeof password !== 'string' ||
      !password ||
      Buffer.byteLength(password) > 1024
    )
      throw new BadRequestException('Invalid credentials input');
    return { username, password };
  }
}
