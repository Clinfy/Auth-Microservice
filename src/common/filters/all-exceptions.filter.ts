import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response, Request } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse: any =
      exception instanceof HttpException ? exception.getResponse() : { message: 'Internal server error' };

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      errorCode: exceptionResponse.errorCode || 'INTERNAL_ERROR',
      message: exceptionResponse.message || 'An unexpected error occurred',
    });
    console.error('EXCEPTION TYPE: ', exception?.constructor?.name);
    console.error(exception)
  }
}