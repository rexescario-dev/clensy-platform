import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { NestjsQueryGraphQLModule } from '@ptc-org/nestjs-query-graphql';
import { Module } from '@nestjs/common';
import { GraphQLModule as NestGraphQLModule } from '@nestjs/graphql';
import type { Request, Response } from 'express';
import { join } from 'path';
import { GraphiqlController } from './graphiql.controller';

const isProduction = process.env.NODE_ENV === 'production';

@Module({
  imports: [
    NestGraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      // playground: false (not a manually-passed `plugins` array) — @nestjs/apollo
      // concatenates any `plugins` we pass with its own dev-mode default (the
      // legacy Playground plugin) rather than replacing it, so passing our own
      // ApolloServerPluginLandingPageDisabled() alongside their default left
      // both registered, and the Playground still won. `playground: false`
      // makes @nestjs/apollo itself register the disabled-landing-page plugin
      // as its only default, with no manual plugins needed here.
      playground: false,
      // Without an explicit `context` factory, @nestjs/apollo's default
      // (`apollo-base.driver.js`'s `wrapContextResolver`) only puts `req` on
      // the GraphQL context, never `res` — `@as-integrations/express5`'s own
      // `expressMiddleware` receives both, but nothing forwards `res`
      // unless we ask it to here. `AdminResolver.login` (Task 5) sets the
      // HttpOnly session cookie via `context.res.cookie(...)`, and
      // `AuthGuard.getResponse()` (Task 4) also reads `context.res` — both
      // silently had `res: undefined` until this factory was added.
      context: ({ req, res }: { req: Request; res: Response }) => ({
        req,
        res,
      }),
    }),
    NestjsQueryGraphQLModule.forRoot({}),
  ],
  controllers: isProduction ? [] : [GraphiqlController],
})
export class GraphqlModule {}
