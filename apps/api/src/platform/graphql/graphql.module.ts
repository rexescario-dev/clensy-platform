import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { GraphQLModule as NestGraphQLModule } from '@nestjs/graphql';
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
    }),
  ],
  controllers: isProduction ? [] : [GraphiqlController],
})
export class GraphqlModule {}
