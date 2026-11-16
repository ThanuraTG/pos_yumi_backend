import { Controller, Post, Body, Get, UseGuards, Req, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);

    // Set HttpOnly refresh token cookie
    const cookieMaxAgeMs = (Number(process.env.JWT_REFRESH_COOKIE_DAYS) || 7) * 24 * 60 * 60 * 1000;
    const cookieSameSite = (process.env.COOKIE_SAME_SITE as 'strict' | 'lax' | 'none') || 'strict';

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: cookieSameSite,
      maxAge: cookieMaxAgeMs
    });

    return {
      accessToken: result.accessToken,
      user: result.user
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: any,
    @Body('refreshToken') bodyToken: string,
    @Res({ passthrough: true }) res: Response
  ) {
    const rawToken = req.cookies?.refreshToken || bodyToken;
    const result = await this.authService.refreshTokens(rawToken);

    const cookieMaxAgeMs = (Number(process.env.JWT_REFRESH_COOKIE_DAYS) || 7) * 24 * 60 * 60 * 1000;
    const cookieSameSite = (process.env.COOKIE_SAME_SITE as 'strict' | 'lax' | 'none') || 'strict';

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: cookieSameSite,
      maxAge: cookieMaxAgeMs
    });

    return {
      accessToken: result.accessToken,
      user: result.user
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@CurrentUser('sub') userId: string) {
    return await this.authService.getProfile(userId);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('refreshToken');
    return { message: 'Logged out successfully' };
  }
}

