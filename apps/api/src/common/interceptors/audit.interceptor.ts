import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import {
  AUDIT_ACTION_KEY,
  SKIP_AUDIT_KEY,
} from '../decorators/metadata.decorators';
import { AuditService } from '../services/audit.service';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    if (!MUTATION_METHODS.has(request.method)) {
      return next.handle();
    }

    const auditAction =
      this.reflector.getAllAndOverride<string>(AUDIT_ACTION_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? `${request.method} ${request.routeOptions?.url ?? request.url}`;

    const user = request.user;
    const entityId =
      request.params?.id ??
      request.params?.stageId ??
      request.params?.caseId ??
      'unknown';

    return next.handle().pipe(
      tap(async (body) => {
        try {
          await this.auditService.log({
            actorUserId: user?.id ?? null,
            action: auditAction,
            entityType: request.routeOptions?.url?.split('/')[1] ?? 'api',
            entityId: typeof body === 'object' && body && 'id' in body ? String((body as { id: string }).id) : String(entityId),
            clinicalCaseId: request.params?.caseId ?? request.body?.clinicalCaseId ?? null,
            stageInstanceId: request.params?.stageId ?? request.body?.stageInstanceId ?? null,
            metadata: { method: request.method, path: request.url },
            ipAddress: request.ip ?? null,
            userAgent: request.headers['user-agent'] ?? null,
          });
        } catch {
          // audit failure must not break mutation
        }
      }),
    );
  }
}
