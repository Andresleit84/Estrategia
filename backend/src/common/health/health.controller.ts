import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { DbService } from '../../database/db.service';
import { RedisService } from '../redis/redis.service';
import { Public } from '../decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly db: DbService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @SkipThrottle()
  @Get()
  async check() {
    const [dbOk, redisOk] = await Promise.all([
      this.db.healthCheck(),
      this.redis.ping().then(() => true).catch(() => false),
    ]);

    const status = dbOk && redisOk ? 'ok' : dbOk ? 'degraded' : 'error';
    return {
      status,
      timestamp: new Date().toISOString(),
      checks: {
        database: dbOk   ? 'ok' : 'error',
        redis:    redisOk ? 'ok' : 'error',
      },
    };
  }

}
