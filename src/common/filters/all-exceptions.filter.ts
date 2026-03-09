import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { Response, Request } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse: any =
      exception instanceof HttpException ? exception.getResponse() : { message: 'Internal server error' };

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      errorCode: exceptionResponse.errorCode || 'INTERNAL_ERROR',
      message: exceptionResponse.message || 'An unexpected error occurred',
    };

    this.logger.error('Unhandled exception', {
      exceptionType: exception?.constructor?.name,
      method: request.method,
      url: request.url,
      ip: request.ip,
      statusCode: status,
      stack: exception instanceof Error ? exception.stack : undefined,
      exception,
    });

    response.status(status).json(errorResponse);
  }
}
