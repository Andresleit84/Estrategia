import {
  ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/nestjs';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException
      ? (exception.getResponse() as any)?.message ?? exception.message
      : 'Error interno del servidor';

    if (status >= 500) {
      this.logger.error(`${req.method} ${req.url} → ${status}`, exception instanceof Error ? exception.stack : undefined);
      if (process.env.SENTRY_DSN) {
        const user = (req as any).user as { user_id?: string; organization_id?: string; role?: string } | undefined;
        Sentry.withScope((scope) => {
          scope.setTag('path', req.url);
          scope.setTag('method', req.method);
          if (user) scope.setUser({ id: user.user_id, segment: user.organization_id });
          Sentry.captureException(exception);
        });
      }
    } else if (status >= 400) {
      this.logger.warn(`${req.method} ${req.url} → ${status}: ${JSON.stringify(message)}`);
    }

    res.status(status).json({
      statusCode: status,
      message,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
