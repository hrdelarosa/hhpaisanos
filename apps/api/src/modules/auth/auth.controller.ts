import { Body, Controller, Get, Header, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service.js';
import type { AuthRequest, AuthUser } from './auth.types.js';
import { LoginPipe, type LoginDto } from './dto/login.dto.js';
import { ChangePasswordPipe, type ChangePasswordDto } from './dto/change-password.dto.js';
import { Public } from './decorators/public.decorator.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { AllowPasswordChange } from './decorators/allow-password-change.decorator.js';
import { CredentialRateGuard } from './guards/credential-rate.guard.js';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private cookieOptions() {
    return { httpOnly: true, secure: this.auth.config.secure, sameSite: 'lax' as const, path: '/' };
  }

  @Post('login')
  @Public()
  @UseGuards(CredentialRateGuard)
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async login(@Body(LoginPipe) input: LoginDto, @Res({ passthrough: true }) response: Response) {
    const session = await this.auth.login(input);
    response.cookie(this.auth.config.cookieName, session.token, {
      ...this.cookieOptions(),
      expires: session.expires,
    });
    return { authenticated: true };
  }

  @Get('me')
  @AllowPasswordChange()
  @Header('Cache-Control', 'no-store')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Post('logout')
  @Public()
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async logout(@Req() request: AuthRequest, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(request);
    response.clearCookie(this.auth.config.cookieName, this.cookieOptions());
  }

  @Post('change-password')
  @AllowPasswordChange()
  @UseGuards(CredentialRateGuard)
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async changePassword(
    @Req() request: AuthRequest,
    @Body(ChangePasswordPipe) input: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.changePassword(request.auth!, input);
    response.clearCookie(this.auth.config.cookieName, this.cookieOptions());
  }
}
