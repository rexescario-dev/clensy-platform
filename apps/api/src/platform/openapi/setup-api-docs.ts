import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// Swagger UI (`/docs`) and the raw document (`/docs-json`, `/docs-yaml`)
// are a schema-disclosure/dev tool, like GraphiQL, so they follow the same
// rule: mounted only when NODE_ENV is not 'production' (#91 decision 3;
// see graphql.module.ts for GraphiQL). What is documented is unchanged.
// Deliberately independent of auth and tenant context.
export function setupApiDocs(
  app: INestApplication,
  nodeEnv: string | undefined,
): void {
  if (nodeEnv === 'production') {
    return;
  }
  const config = new DocumentBuilder()
    .setTitle('Clensy Platform API')
    .setDescription('REST surface — see /graphql for the GraphQL equivalent')
    .setVersion('0.0.1')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
}
