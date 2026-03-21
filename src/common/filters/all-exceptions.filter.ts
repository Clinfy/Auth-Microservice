import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Response, Request } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { BaseServiceException } from 'src/common/exceptions/base-service.exception';

@Injectable()
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

    // Extract error code from top-level exception
    let errorCode = 'INTERNAL_ERROR';
    if (exception instanceof BaseServiceException) {
      errorCode = exception.getErrorCode();
    } else if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse() as any;
      errorCode = exceptionResponse.errorCode || 'INTERNAL_ERROR';
    }

    // Extract causeCode from deepest BaseServiceException in chain
    let causeCode: string | undefined;
    if (exception instanceof Error) {
      causeCode = BaseServiceException.getDeepestErrorCode(exception);
      // Only include if different from errorCode
      if (causeCode === errorCode) {
        causeCode = undefined;
      }
    }

    // Get user-facing message from deepest HttpException
    let userMessage = 'An unexpected error occurred';
    if (exception instanceof Error) {
      userMessage = BaseServiceException.getDeepestHttpExceptionMessage(exception);
    }

    // Build cause chain for logging
    const causeChain = exception instanceof Error ? BaseServiceException.getCauseChain(exception) : [];

    // Enhanced Winston logging with all metadata
    this.logger.error('Unhandled exception', {
      exceptionType: exception?.constructor?.name,
      method: request.method,
      url: request.url,
      ip: request.ip,
      statusCode: status,
      errorCode,
      causeCode,
      userMessage,
      causeChain,
      stack: exception instanceof Error ? exception.stack : undefined,
    });

    // Response includes causeCode only when present and different
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      errorCode,
      ...(causeCode && { causeCode }),
      message: userMessage,
    });
  }
}
