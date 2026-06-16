import 'reflect-metadata';
import * as Sentry from '@sentry/nestjs';

// Sentry must initialize before any other import that creates modules
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    release: process.env.APP_VERSION,
    ignoreErrors: [
      'UnauthorizedException',
      'ForbiddenException',
      'NotFoundException',
      'BadRequestException',
      'ConflictException',
    ],
  });
}

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const isProdEnv = process.env.NODE_ENV === 'production';

  const app = await NestFactory.create(AppModule, {
    rawBody: true, // required for Stripe webhook signature verification
    // In production: JSON lines to stdout, parsed by PM2/log aggregators.
    // In development: human-readable NestJS default.
    logger: isProdEnv
      ? {
          log:     (msg, ctx) => process.stdout.write(JSON.stringify({ level: 'info',  msg, ctx,  ts: new Date().toISOString() }) + '\n'),
          error:   (msg, ctx) => process.stderr.write(JSON.stringify({ level: 'error', msg, ctx,  ts: new Date().toISOString() }) + '\n'),
          warn:    (msg, ctx) => process.stdout.write(JSON.stringify({ level: 'warn',  msg, ctx,  ts: new Date().toISOString() }) + '\n'),
          debug:   ()        => undefined,
          verbose: ()        => undefined,
          fatal:   (msg, ctx) => process.stderr.write(JSON.stringify({ level: 'fatal', msg, ctx, ts: new Date().toISOString() }) + '\n'),
        }
      : ['error', 'warn', 'log'],
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3010);
  const frontendUrl = config.get<string>('FRONTEND_URL', 'http://localhost:3000');

  const isProd = isProdEnv;

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'same-site' },
    contentSecurityPolicy: false, // handled by Nginx reverse proxy
    strictTransportSecurity: isProd
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
  }));

  // Permissions-Policy: restrict browser features to minimum needed
  app.use((_req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    next();
  });

  app.use(cookieParser(config.get<string>('COOKIE_SECRET')));

  app.enableCors({
    origin: frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-organization-slug', 'ngrok-skip-browser-warning'],
  });

  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('api/v1');

  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('OKR System API')
      .setDescription('REST API para el sistema de gestión OKR')
      .setVersion('1.0')
      .addCookieAuth('access_token')
      .addTag('auth', 'Autenticación y sesión')
      .addTag('cycles', 'Ciclos OKR')
      .addTag('objectives', 'Objetivos')
      .addTag('key-results', 'Key Results')
      .addTag('check-ins', 'Check-ins')
      .addTag('initiatives', 'Iniciativas')
      .addTag('teams', 'Equipos')
      .addTag('reports', 'Reportes y dashboards')
      .addTag('ai', 'Agentes de IA')
      .addTag('mcp', 'Model Context Protocol')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(port);
  console.log(`OKR Backend running on port ${port}${!isProd ? ' — Swagger: http://localhost:' + port + '/api/docs' : ''}`);
}

bootstrap();
