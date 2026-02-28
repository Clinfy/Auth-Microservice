import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {DocumentBuilder, SwaggerModule} from "@nestjs/swagger";
import {useContainer} from "class-validator";
import {ValidationPipe} from "@nestjs/common";
import {writeFileSync} from "node:fs";

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {bufferLogs: true});

    //Trust Proxy
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.set('trust proxy', true);

    //Logs
    useContainer(app.select(AppModule), { fallbackOnErrors: true }); // <—
    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions:
            { enableImplicitConversion: true
            },
    }));

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
