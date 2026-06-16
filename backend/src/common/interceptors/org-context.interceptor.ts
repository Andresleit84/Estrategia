import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { orgContextStorage } from '../../database/org-context';

@Injectable()
export class OrgContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const orgId: string | undefined = req.user?.organization_id;
    if (!orgId) return next.handle();

    return new Observable(subscriber => {
      orgContextStorage.run(orgId, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
