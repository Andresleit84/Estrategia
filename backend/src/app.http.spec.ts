/**
 * HTTP Contract Tests
 * Boots a minimal NestJS app with mocked infrastructure.
 * Tests: auth guard, DTO validation, routing, response shape, error format.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';

import { AuthController }  from './modules/auth/auth.controller';
import { AuthService }     from './modules/auth/auth.service';
import { JwtStrategy }     from './modules/auth/strategies/jwt.strategy';
import { LocalStrategy }   from './modules/auth/strategies/local.strategy';
import { JwtAuthGuard }    from './modules/auth/guards/jwt-auth.guard';
import { HealthController } from './common/health/health.controller';
import { DbService }       from './database/db.service';
import { RedisService }    from './common/redis/redis.service';
import { EmailService }    from './common/email/email.service';

const JWT_TEST_SECRET = 'test-jwt-secret-for-http-contract-tests';

const mockDb    = { query: jest.fn(), queryOne: jest.fn(), execute: jest.fn(), healthCheck: jest.fn().mockResolvedValue(true) };
const mockRedis = { ping: jest.fn().mockResolvedValue('PONG'), getOrSet: jest.fn(), delPattern: jest.fn() };
const mockEmail = { sendPasswordReset: jest.fn(), sendInvitation: jest.fn() };

describe('HTTP Contract Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.JWT_SECRET = JWT_TEST_SECRET;

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        PassportModule,
        JwtModule.register({ secret: JWT_TEST_SECRET, signOptions: { expiresIn: '15m' } }),
      ],
      controllers: [AuthController, HealthController],
      providers: [
        { provide: APP_GUARD,    useClass: JwtAuthGuard },
        AuthService,
        JwtStrategy,
        LocalStrategy,
        { provide: DbService,    useValue: mockDb },
        { provide: RedisService, useValue: mockRedis },
        { provide: EmailService, useValue: mockEmail },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));
    await app.init();
  }, 30000);

  afterAll(async () => {
    if (app) await app.close();
  });

  // ── Auth guard ─────────────────────────────────────────────────────────────

  describe('Auth guard — JWT protection', () => {
    it('returns 401 when no token is provided on protected route', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);
    });

    it('returns 401 when Authorization header has invalid token', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);
    });
  });

  // ── Auth guard — token format validation ──────────────────────────────────

  describe('Auth guard — token format validation', () => {
    it('returns 401 when Authorization header uses Basic scheme instead of Bearer', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Basic dXNlcjpwYXNz')
        .expect(401);
    });

    it('returns 401 when token is an empty string after Bearer', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer ')
        .expect(401);
    });

    it('returns 401 when JWT has wrong number of segments (only 1 dot)', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer header.payload')
        .expect(401);
    });

    it('returns 401 with expired JWT', async () => {
      // Manually crafted expired token structure (invalid signature)
      const expiredToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIiwiZXhwIjoxfQ.FAKE';
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });

  // ── Public routes — no auth needed ────────────────────────────────────────

  describe('Public routes — accessible without auth', () => {
    it('GET /health returns 200 with status field', async () => {
      const res = await request(app.getHttpServer())
        .get('/health')
        .expect(200);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('checks');
    });

    it('GET /health response includes database and redis checks', async () => {
      const res = await request(app.getHttpServer())
        .get('/health')
        .expect(200);
      expect(res.body.checks).toHaveProperty('database');
      expect(res.body.checks).toHaveProperty('redis');
    });

    it('GET /health timestamp is a valid ISO date string', async () => {
      const res = await request(app.getHttpServer())
        .get('/health')
        .expect(200);
      expect(() => new Date(res.body.timestamp).toISOString()).not.toThrow();
    });
  });

  // ── DTO validation ─────────────────────────────────────────────────────────

  describe('DTO validation — POST /auth/trial', () => {
    it('returns 400 when body is empty', async () => {
      await request(app.getHttpServer())
        .post('/auth/trial')
        .send({})
        .expect(400);
    });

    it('returns 400 when email is invalid format', async () => {
      await request(app.getHttpServer())
        .post('/auth/trial')
        .send({ name: 'Test', email: 'not-an-email', company: 'Acme', password: 'password123' })
        .expect(400);
    });

    it('returns 400 when password is too short (< 8 chars)', async () => {
      await request(app.getHttpServer())
        .post('/auth/trial')
        .send({ name: 'Test', email: 'test@test.com', company: 'Acme', password: '1234' })
        .expect(400);
    });

    it('returns 400 when name is missing', async () => {
      await request(app.getHttpServer())
        .post('/auth/trial')
        .send({ email: 'test@test.com', company: 'Acme', password: 'password123' })
        .expect(400);
    });

    it('returns 400 when company is missing', async () => {
      await request(app.getHttpServer())
        .post('/auth/trial')
        .send({ name: 'Test', email: 'test@test.com', password: 'password123' })
        .expect(400);
    });

    it('returns 400 validation error body has message array', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/trial')
        .send({})
        .expect(400);
      expect(res.body).toHaveProperty('message');
      expect(Array.isArray(res.body.message)).toBe(true);
    });
  });

  // ── DTO validation — boundary cases ───────────────────────────────────────

  describe('POST /auth/trial — boundary validation', () => {
    it('returns 400 when password is exactly 7 chars (boundary)', async () => {
      await request(app.getHttpServer())
        .post('/auth/trial')
        .send({ name: 'Test', email: 'test@test.com', company: 'Acme', password: '1234567' })
        .expect(400);
    });

    it('returns 400 when email has multiple @ symbols', async () => {
      await request(app.getHttpServer())
        .post('/auth/trial')
        .send({ name: 'Test', email: 'test@@test.com', company: 'Acme', password: 'password123' })
        .expect(400);
    });

    it('returns 400 when additional unknown field is sent (forbidNonWhitelisted)', async () => {
      await request(app.getHttpServer())
        .post('/auth/trial')
        .send({ name: 'Test', email: 'test@test.com', company: 'Acme', password: 'password123', unknownField: 'hacked' })
        .expect(400);
    });
  });

  // /auth/login uses LocalAuthGuard (Passport)
  describe('POST /auth/login — guard behaviour', () => {
    it('returns 401 when credentials are missing', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({})
        .expect(401);
    });

    it('returns 401 when credentials are wrong', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@test.com', password: 'wrongpass' })
        .expect(401);
    });

    it('returns 401 when email is invalid format', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'not-valid', password: 'password123' })
        .expect(401);
    });
  });

  // /auth/forgot-password always returns 200 — security: never reveal if email exists
  describe('POST /auth/forgot-password — security contract', () => {
    it('returns 200 even when email is missing (security: no info leak)', async () => {
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({})
        .expect(200);
    });

    it('returns 200 for unknown email (security: no info leak)', async () => {
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'unknown@nowhere.com' })
        .expect(200);
    });
  });

  // ── Security — forgot-password never leaks ────────────────────────────────

  describe('Security — forgot-password never leaks', () => {
    it('returns 200 for SQL injection attempt in email field', async () => {
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: "' OR '1'='1'; --" })
        .expect(200);
    });

    it('returns 200 for XSS payload in email field', async () => {
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: '<script>alert(1)</script>@evil.com' })
        .expect(200);
    });

    it('returns 200 for empty string email', async () => {
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: '' })
        .expect(200);
    });

    it('returns 200 consistently across 5 rapid calls (no rate-limit in test)', async () => {
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          request(app.getHttpServer())
            .post('/auth/forgot-password')
            .send({ email: 'rapid@test.com' }),
        ),
      );
      for (const res of results) {
        expect(res.status).toBe(200);
      }
    });
  });

  // ── 404 for unknown routes ─────────────────────────────────────────────────

  describe('Routing', () => {
    it('returns 404 for unknown endpoints', async () => {
      await request(app.getHttpServer())
        .get('/this-route-does-not-exist-at-all')
        .expect(404);
    });

    it('returns 404 for deep unknown paths', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/this/does/not/exist')
        .expect(404);
    });
  });

  // ── Response format — error shape ─────────────────────────────────────────

  describe('Response format — error shape', () => {
    it('400 validation error body has statusCode: 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/trial')
        .send({})
        .expect(400);
      expect(res.body.statusCode).toBe(400);
    });

    it('400 validation error has error field (Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/trial')
        .send({})
        .expect(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toBe('Bad Request');
    });

    it('401 unauthorized response has statusCode: 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);
      expect(res.body.statusCode).toBe(401);
    });

    it('404 not found response has statusCode: 404', async () => {
      const res = await request(app.getHttpServer())
        .get('/this-route-does-not-exist-at-all')
        .expect(404);
      expect(res.body.statusCode).toBe(404);
    });
  });

  // ── Response time baseline ─────────────────────────────────────────────────

  describe('Performance — HTTP response times', () => {
    it('GET /health responds in < 200ms', async () => {
      const start = Date.now();
      await request(app.getHttpServer()).get('/health');
      expect(Date.now() - start).toBeLessThan(200);
    });

    it('POST /auth/trial (invalid DTO) responds in < 100ms', async () => {
      const start = Date.now();
      await request(app.getHttpServer()).post('/auth/trial').send({});
      expect(Date.now() - start).toBeLessThan(100);
    });

    it('10 concurrent /health requests complete in < 500ms', async () => {
      const start = Date.now();
      await Promise.all(Array.from({ length: 10 }, () =>
        request(app.getHttpServer()).get('/health'),
      ));
      expect(Date.now() - start).toBeLessThan(500);
    });

    it('POST /auth/forgot-password responds in < 200ms', async () => {
      const start = Date.now();
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'perf@test.com' });
      expect(Date.now() - start).toBeLessThan(200);
    });
  });
});
