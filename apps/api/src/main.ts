import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Clensy Platform API')
    .setDescription('REST surface — see /graphql for the GraphQL equivalent')
    .setVersion('0.0.1')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  // Locally-bundled GraphiQL static assets (graphiql.js/.css) — dev-only,
  // matching the GraphiqlController route guard in graphql.module.ts.
  // Prefix is deliberately NOT /graphiql: Express's static middleware runs
  // ahead of routing, so a request for the bare /graphiql path would be
  // caught as a directory-index request (redirecting to /graphiql/) before
  // GraphiqlController's own @Get() handler ever saw it.
  if (process.env.NODE_ENV !== 'production') {
    app.useStaticAssets(join(__dirname, '..', 'public', 'graphiql'), {
      prefix: '/graphiql-static',
    });
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
