import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';

export type ChangePasswordDto = { currentPassword: string; newPassword: string };

export function validateNewPassword(password: unknown): asserts password is string {
  // Count Unicode code points, not UTF-16 code units; never normalize credentials.
  if (
    typeof password !== 'string' ||
    Array.from(password).length < 15 ||
    Array.from(password).length > 128
  ) {
    throw new BadRequestException('New password must contain 15–128 characters');
  }
}

@Injectable()
export class ChangePasswordPipe implements PipeTransform<unknown, ChangePasswordDto> {
  transform(value: unknown): ChangePasswordDto {
    if (!value || typeof value !== 'object')
      throw new BadRequestException('Invalid password input');
    const { currentPassword, newPassword } = value as Record<string, unknown>;
    if (
      typeof currentPassword !== 'string' ||
      !currentPassword ||
      Buffer.byteLength(currentPassword) > 1024
    ) {
      throw new BadRequestException('Invalid password input');
    }
    validateNewPassword(newPassword);
    return { currentPassword, newPassword };
  }
}
