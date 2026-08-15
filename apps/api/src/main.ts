import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // `JwtStrategy`'s cookie extractor (platform/auth) reads the session JWT
  // off `req.cookies[SESSION_COOKIE_NAME]` — without this middleware,
  // Express never parses the `Cookie` header into `req.cookies` at all, so
  // every authenticated request would see it as `undefined`.
  app.use(cookieParser());

  // `apps/web` and `apps/api` are served from different origins (spec §4) —
  // `credentials: true` is required for the browser to attach the HttpOnly
  // session cookie cross-origin, and per the Fetch spec that only works
  // paired with a specific (non-wildcard) `origin`. `WEB_ORIGIN` is an
  // env var so this doesn't hardcode a single environment's URL; the
  // `localhost:3001` fallback matches `apps/web`'s local dev port.
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3001',
    credentials: true,
  });

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
