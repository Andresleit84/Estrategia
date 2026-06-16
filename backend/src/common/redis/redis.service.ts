import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.get<string>('REDIS_URL', 'redis://localhost:6379');
    const password = this.config.get<string>('REDIS_PASSWORD');
    this.client = new Redis(url, {
      password: password || undefined,
      lazyConnect: true,
      keepAlive: 30_000,
      maxRetriesPerRequest: 3,
    });
    this.client.on('error', (err: unknown) => this.logger.warn(`Redis error: ${err instanceof Error ? err.message : String(err)}`));
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }

  async ping(): Promise<void> {
    await this.client.ping();
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async delPattern(pattern: string): Promise<void> {
    const keys = await this.client.keys(pattern);
    if (!keys.length) return;
    // Batch in chunks of 100 to avoid spreading thousands of args onto the call stack
    for (let i = 0; i < keys.length; i += 100) {
      await this.client.del(...keys.slice(i, i + 100));
    }
  }

  async getOrSet<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    try {
      const cached = await this.client.get(key);
      if (cached !== null) return JSON.parse(cached) as T;
    } catch {
      // Redis unavailable or parse error — fall through to live query
    }
    const value = await fn();
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // Redis write failure is non-fatal
    }
    return value;
  }

  async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; count: number; limit: number }> {
    try {
      const count = await this.client.incr(key);
      if (count === 1) await this.client.expire(key, windowSeconds);
      return { allowed: count <= limit, count, limit };
    } catch {
      // Redis unavailable — allow by default
      return { allowed: true, count: 0, limit };
    }
  }
}
