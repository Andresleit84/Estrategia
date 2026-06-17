import {
  Controller, Post, Body, Req, Res, UseGuards, HttpCode, Get, Query,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserSession } from './types/auth.types';

class TrialRegisterDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name: string;
  @IsEmail() @MaxLength(254) email: string;
  @IsString() @IsNotEmpty() @MaxLength(120) company: string;
  @IsString() @MinLength(8) @MaxLength(128) password: string;
}

function cookieOpts(maxAge = 30 * 24 * 60 * 60 * 1000) {
  const isSecure = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isSecure && process.env.COOKIE_SECURE !== 'false',
    sameSite: 'strict' as const,
    path: '/',
    maxAge,
  };
}
const ACCESS_TTL = 15 * 60 * 1000;
const REFRESH_TTL = 30 * 24 * 60 * 60 * 1000;

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ auth: { limit: 3, ttl: 3_600_000 } })
  @Post('trial')
  @HttpCode(201)
  async registerTrial(@Body() dto: TrialRegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const ip = req.ip ?? '';
    const deviceInfo = (req.headers['user-agent'] as string) ?? '';
    const { accessToken, refreshToken, user } = await this.auth.registerTrial(dto, ip, deviceInfo);
    res.cookie('access_token', accessToken, cookieOpts(ACCESS_TTL));
    res.cookie('refresh_token', refreshToken, cookieOpts(REFRESH_TTL));
    return { user };
  }

  @Public()
  @Throttle({ auth: { limit: 5, ttl: 3_600_000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.auth.register(dto);
    res.cookie('access_token', accessToken, cookieOpts(ACCESS_TTL));
    res.cookie('refresh_token', refreshToken, cookieOpts(REFRESH_TTL));
    return { user };
  }

  @Public()
  @Throttle({ auth: { limit: 5, ttl: 3_600_000 } })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(200)
  async login(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = req.user as UserSession;
    const ip = req.ip ?? '';
    const deviceInfo = req.headers['user-agent'] ?? '';

    const { accessToken, refreshToken } = await this.auth.login(user, ip, deviceInfo);
    res.cookie('access_token', accessToken, cookieOpts(ACCESS_TTL));
    res.cookie('refresh_token', refreshToken, cookieOpts(REFRESH_TTL));
    return { user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawToken: string | undefined = req.cookies?.refresh_token;
    if (!rawToken) throw new UnauthorizedException('No refresh token');

    const result = await this.auth.refresh(rawToken, req.ip ?? '', req.headers['user-agent'] ?? '');
    if (!result) throw new UnauthorizedException('Token inválido o expirado');

    res.cookie('access_token', result.accessToken, cookieOpts(ACCESS_TTL));
    res.cookie('refresh_token', result.refreshToken, cookieOpts(REFRESH_TTL));
    return { ok: true };
  }

  @Post('switch-org')
  @HttpCode(200)
  async switchOrg(
    @CurrentUser() user: UserSession,
    @Body() body: { org_id: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user: newUser } = await this.auth.switchOrg(
      user.email,
      body.org_id,
      req.ip ?? '',
      req.headers['user-agent'] ?? '',
    );
    res.cookie('access_token', accessToken, cookieOpts(ACCESS_TTL));
    res.cookie('refresh_token', refreshToken, cookieOpts(REFRESH_TTL));
    return { user: newUser };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawToken: string | undefined = req.cookies?.refresh_token;
    if (rawToken) await this.auth.logout(rawToken);
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
  }

  @Post('logout-all')
  @HttpCode(204)
  async logoutAll(@CurrentUser() user: UserSession, @Res({ passthrough: true }) res: Response) {
    await this.auth.logoutAll(user.user_id);
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: UserSession) {
    return { user };
  }

  @Get('my-orgs')
  myOrgs(@CurrentUser() user: UserSession) {
    return this.auth.getMyOrgs(user.email);
  }

  @Public()
  @Get('invitation')
  getInvitation(@Query('token') token: string) {
    return this.auth.getInvitationInfo(token);
  }

  @Public()
  @Throttle({ auth: { limit: 5, ttl: 3_600_000 } })
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() body: { email: string }) {
    if (!body.email) return { ok: true };
    await this.auth.forgotPassword(body.email);
    return { ok: true };
  }

  @Public()
  @Get('reset-password')
  getResetTokenInfo(@Query('token') token: string) {
    return this.auth.getResetTokenInfo(token);
  }

  @Public()
  @Throttle({ auth: { limit: 5, ttl: 3_600_000 } })
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(
    @Body() body: { token: string; newPassword: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } = await this.auth.consumeResetToken(
      body.token, body.newPassword, req.ip ?? '', req.headers['user-agent'] ?? '',
    );
    res.cookie('access_token', accessToken, cookieOpts(ACCESS_TTL));
    res.cookie('refresh_token', refreshToken, cookieOpts(REFRESH_TTL));
    return { user };
  }

  @Public()
  @Throttle({ auth: { limit: 10, ttl: 3_600_000 } })
  @Post('accept-invitation')
  async acceptInvitation(
    @Body() body: { token: string; name: string; password: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip ?? '';
    const device = req.headers['user-agent'] ?? '';
    const { accessToken, refreshToken, user } = await this.auth.acceptInvitation(
      body.token, body.name, body.password, ip, device,
    );
    res.cookie('access_token',  accessToken,  cookieOpts(ACCESS_TTL));
    res.cookie('refresh_token', refreshToken, cookieOpts(REFRESH_TTL));
    return { user };
  }
}
