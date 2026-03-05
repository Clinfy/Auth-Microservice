import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { useContainer } from 'class-validator';
import { BadRequestException, HttpStatus, ValidationPipe } from '@nestjs/common';
import { writeFileSync } from 'node:fs';
import { AllExceptionsFilter } from 'src/common/filters/all-exceptions.filter';
import { findFirstErrorCode, findFirstMessage } from 'src/common/tools/find-errors-data';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  //Trust Proxy
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  //Error Handler
  const exceptionFilter = app.get(AllExceptionsFilter);
  app.useGlobalFilters(exceptionFilter);

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
bootstrap();
