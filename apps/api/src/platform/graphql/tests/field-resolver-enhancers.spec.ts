import { Test } from '@nestjs/testing';
import { GRAPHQL_MODULE_OPTIONS, GqlModuleOptions } from '@nestjs/graphql';
import { GraphqlModule } from '../graphql.module';

// #85 Task 8: nestjs-query relation resolvers (`Relatable`'s `booking`,
// `customer`, `bookings`, …) get their tenant filter from
// `@RelationAuthorizerFilter`, which reads `context.authorizer`. That field
// is set only by the `AuthorizerInterceptor` nestjs-query attaches to each
// relation `@ResolveField` — and `@nestjs/graphql` runs interceptors on
// field resolvers only when `fieldResolverEnhancers` includes
// 'interceptors'. Without it, a relation reached from a plain Nest
// `@Query` (e.g. `job(id) { booking { … } }`) is resolved with no
// authorizer and therefore no tenant filter at all.
describe('GraphqlModule field resolver enhancers', () => {
  it("runs interceptors on field resolvers so nestjs-query's relation AuthorizerInterceptor applies", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [GraphqlModule],
    }).compile();

    try {
      const options = moduleRef.get<GqlModuleOptions>(GRAPHQL_MODULE_OPTIONS);
      expect(options.fieldResolverEnhancers).toContain('interceptors');
    } finally {
      await moduleRef.close();
    }
  });
});
