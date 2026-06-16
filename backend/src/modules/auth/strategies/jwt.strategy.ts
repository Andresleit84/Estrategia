import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { DbService } from '../../../database/db.service';
import { JwtPayload, UserSession } from '../types/auth.types';

function extractJwtFromCookieOrHeader(req: Request): string | null {
  if (req.cookies?.access_token) return req.cookies.access_token;
  return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly db: DbService,
  ) {
    super({
      jwtFromRequest: extractJwtFromCookieOrHeader,
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<UserSession> {
    const session = await this.db.queryOne<UserSession>(
      `SELECT * FROM v_user_session WHERE user_id = $1`,
      [payload.sub],
    );
    if (!session) throw new UnauthorizedException();
    if (session.org_trial_expires_at && new Date(session.org_trial_expires_at) < new Date()) {
      throw new UnauthorizedException('TRIAL_EXPIRED');
    }
    return session;
  }
}
