import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Внутренняя ошибка сервера';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const obj = res as Record<string, unknown>;
        if (Array.isArray(obj.message)) {
          message = (obj.message as string[]).join('; ');
        } else if (typeof obj.message === 'string') {
          message = obj.message;
        } else if (typeof obj.error === 'string') {
          message = obj.error;
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message || message;
    }

    response.status(status).send({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
