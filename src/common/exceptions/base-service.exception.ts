import { HttpException, HttpStatus } from '@nestjs/common';

export interface ServiceExceptionResponse {
  message: string;
  errorCode: string;
  statusCode: number;
}

export abstract class BaseServiceException extends HttpException {
  constructor(message: string, errorCode: string, status: HttpStatus, cause?: Error) {
    const response: ServiceExceptionResponse = {
      message,
      errorCode,
      statusCode: status,
    };
    super(response, status, { cause });
  }

  getErrorCode(): string {
    const response = this.getResponse() as ServiceExceptionResponse;
    return response.errorCode;
  }

  static getDeepestHttpExceptionMessage(error: Error): string {
    let current: Error | undefined = error;
    let deepestHttpExceptionMessage: string = 'An unexpected error occurred';

    const extractMessage = (err: HttpException): string => {
      const response = err.getResponse();
      if (typeof response === 'string') return response;

      const msg = (response as any).message;
      return Array.isArray(msg) ? msg.join(', ') : msg || err.message;
    };

    if (error instanceof HttpException) {
      deepestHttpExceptionMessage = extractMessage(error);
    }

    while (current?.cause instanceof Error) {
      current = current.cause;
      if (current instanceof HttpException) {
        deepestHttpExceptionMessage = extractMessage(current);
      }
    }

    return deepestHttpExceptionMessage;
  }

  static getCauseChain(error: Error): Array<{ type: string; message: string }> {
    const chain: Array<{ type: string; message: string }> = [];
    let current: Error | undefined = error;

    while (current) {
      chain.push({
        type: current.constructor.name,
        message: current.message,
      });
      current = current.cause instanceof Error ? current.cause : undefined;
    }

    return chain;
  }

  /**
   * Extracts the errorCode from the deepest BaseServiceException in the cause chain.
   * Returns undefined if no BaseServiceException with errorCode is found in the chain.
   */
  static getDeepestErrorCode(error: Error): string | undefined {
    let current: Error | undefined = error;
    let deepestErrorCode: string | undefined;

    while (current) {
      if (current instanceof BaseServiceException) {
        deepestErrorCode = current.getErrorCode();
      }
      current = current.cause instanceof Error ? current.cause : undefined;
    }

    return deepestErrorCode;
  }
}
