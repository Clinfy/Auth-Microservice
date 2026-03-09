import { ValidationError } from '@nestjs/common';

export function findFirstErrorCode(errors: ValidationError[]): string | undefined {
  const stack: ValidationError[] = [...errors];

  while (stack.length) {
    const err = stack.shift()!;

    if (err.contexts) {
      for (const key of Object.keys(err.contexts)) {
        const ctx = (err.contexts as any)[key];
        if (ctx?.errorCode) return ctx.errorCode;
      }
    }

    if (err.children?.length) stack.push(...err.children);
  }

  return undefined;
}

export function findFirstMessage(errors: ValidationError[]): string {
  const stack: ValidationError[] = [...errors];

  while (stack.length) {
    const err = stack.shift()!;
    if (err.constraints) {
      const firstKey = Object.keys(err.constraints)[0];
      if (firstKey) return err.constraints[firstKey];
    }
    if (err.children?.length) stack.push(...err.children);
  }

  return 'Validation failed';
}
