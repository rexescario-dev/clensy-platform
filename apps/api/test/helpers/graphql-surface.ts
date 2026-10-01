import { INestApplication } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import { GraphQLSchemaHost, TypeMetadataStorage } from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app/app.module';
import { ROLES_KEY } from '../../src/platform/auth/decorators/roles.decorator';
import { Role } from '../../src/platform/auth/domain/role';

export type RootOperation = 'Mutation' | 'Query';

export interface RootHandler {
  operation: RootOperation;
  field: string;
  owner: string;
  isLiveProvider: boolean;
  ownMethod: boolean;
  guards: unknown[];
  roles: Role[] | undefined;
}

// Boots the real AppModule (as `paginated-collections-allowlist` does) plus
// Nest discovery, so the #90 guard suites read the live schema and the
// metadata `AuthGuard` evaluates — never a hand-copied inventory.
export async function bootGraphqlSurface(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule, DiscoveryModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

// One entry per root handler in the metadata @nestjs/graphql builds the
// schema from. After schema compile it re-targets handlers declared on a
// base class (nestjs-query's generated `queryMany`/`findById`) to the
// concrete resolver class, so `target.prototype[methodName]` is the same
// function Nest invokes. Guards are method + class (both run); roles are
// method-first, then class — the `Reflector.getAllAndOverride` precedence
// `AuthGuard` uses.
export function collectRootHandlers(app: INestApplication): RootHandler[] {
  const liveClasses = new Set<unknown>(
    app
      .get(DiscoveryService)
      .getProviders()
      .map((wrapper) => wrapper.instance as unknown)
      .filter(
        (instance): instance is object =>
          typeof instance === 'object' && instance !== null,
      )
      .map((instance) => instance.constructor),
  );
  const entries = [
    ...TypeMetadataStorage.getQueriesMetadata().map((meta) => ({
      meta,
      operation: 'Query' as const,
    })),
    ...TypeMetadataStorage.getMutationsMetadata().map((meta) => ({
      meta,
      operation: 'Mutation' as const,
    })),
  ];
  return entries.map(({ meta, operation }) => {
    const target = meta.target as {
      name: string;
      prototype: Record<string, unknown>;
    };
    const handler = target.prototype[meta.methodName];
    if (typeof handler !== 'function') {
      throw new Error(
        `${operation}.${meta.schemaName}: ${target.name}.${meta.methodName} is not a function`,
      );
    }
    return {
      field: meta.schemaName,
      guards: [
        ...((Reflect.getMetadata(GUARDS_METADATA, handler) as
          unknown[] | undefined) ?? []),
        ...((Reflect.getMetadata(GUARDS_METADATA, target) as
          unknown[] | undefined) ?? []),
      ],
      isLiveProvider: liveClasses.has(target),
      operation,
      owner: `${target.name}.${meta.methodName}`,
      ownMethod: Object.prototype.hasOwnProperty.call(
        target.prototype,
        meta.methodName,
      ),
      roles:
        (Reflect.getMetadata(ROLES_KEY, handler) as Role[] | undefined) ??
        (Reflect.getMetadata(ROLES_KEY, target) as Role[] | undefined),
    };
  });
}

export function rootFields(
  app: INestApplication,
): { operation: RootOperation; field: string }[] {
  const { schema } = app.get(GraphQLSchemaHost);
  return [
    ...Object.keys(schema.getQueryType()?.getFields() ?? {}).map((field) => ({
      field,
      operation: 'Query' as const,
    })),
    ...Object.keys(schema.getMutationType()?.getFields() ?? {}).map(
      (field) => ({ field, operation: 'Mutation' as const }),
    ),
  ];
}
