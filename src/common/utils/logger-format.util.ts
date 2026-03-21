import { HttpException } from '@nestjs/common';

export const serializeError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return { message: String(error) };
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...(error instanceof HttpException && {
      details: error.getResponse(),
    }),
    ...(error.cause instanceof Error && {
      cause: serializeError(error.cause),
    }),
  };
};
