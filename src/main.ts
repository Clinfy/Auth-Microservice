import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { useContainer } from 'class-validator';
import { BadRequestException, HttpStatus, ValidationError, ValidationPipe } from '@nestjs/common';
import { writeFileSync } from 'node:fs';
import { AllExceptionsFilter } from 'src/common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  //Trust Proxy
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  //Error Handler
  app.useGlobalFilters(new AllExceptionsFilter());

  //Logs
  useContainer(app.select(AppModule), { fallbackOnErrors: true }); // <—
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      validationError: { target: false, value: true },
      exceptionFactory: (errors) => {
        const errorCode = findFirstErrorCode(errors) ?? 'VALIDATION_ERROR';
        const message = findFirstMessage(errors);
        return new BadRequestException({
          statusCode: HttpStatus.BAD_REQUEST,
          errorCode,
          message,
        })
      },
    }),
  );

  //Swagger
  const config = new DocumentBuilder()
    .setTitle('Clinify Users Microservice')
    .setDescription('Docs')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  writeFileSync('./openapi.json', JSON.stringify(document, null, 2));
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}

function findFirstErrorCode(errors: ValidationError[]): string | undefined {
  const stack: ValidationError[] = [...errors];

  while (stack.length) {
    const err = stack.shift()!;

    // contexts tiene la forma: { [constraintName]: { errorCode: '...' , ... } }
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

function findFirstMessage(errors: ValidationError[]): string {
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
bootstrap();
