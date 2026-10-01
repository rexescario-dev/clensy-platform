import { INestApplication, RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
  VERSION_METADATA,
} from '@nestjs/common/constants';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../src/platform/auth/decorators/roles.decorator';
import type { Role } from '../../src/platform/auth/domain/role';

export interface DeclaredRoute {
  key: string;
  // `<Controller>.<method>`: the controller Nest routes to.
  owner: string;
  // The class in that controller's prototype chain that defines the
  // handler (MetadataScanner also returns inherited methods). Diagnostic.
  declaredOn: string;
  guards: unknown[];
  roles: Role[] | undefined;
}

const SUPPORTED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

export function routeKey(method: string, path: string): string {
  const normalized = `/${path}`.replace(/\/+/g, '/').replace(/(.)\/$/, '$1');
  return `${method.toUpperCase()} ${normalized}`;
}

function declaringClass(prototype: object, methodName: string): string {
  for (
    let current: object | null = prototype;
    current;
    current = Object.getPrototypeOf(current) as object | null
  ) {
    if (Object.prototype.hasOwnProperty.call(current, methodName)) {
      return (current as { constructor: { name: string } }).constructor.name;
    }
  }
  throw new Error(`${methodName}: no declaring class in the prototype chain`);
}

function singlePath(value: unknown, where: string): string {
  if (value === undefined) return '';
  if (typeof value !== 'string') {
    throw new Error(
      `${where}: unsupported path metadata ${JSON.stringify(value)}`,
    );
  }
  return value;
}

// Declared inventory: what Nest's RouterExplorer registers, read from the
// same metadata it reads. Guards are concatenated class-first then
// method, the order GuardsContextCreator builds; roles use the app's own
// Reflector with AuthGuard's exact getAllAndOverride([handler, class]).
export function collectDeclaredRoutes(app: INestApplication): DeclaredRoute[] {
  const discovery = app.get(DiscoveryService);
  const scanner = app.get(MetadataScanner);
  const reflector = app.get(Reflector);
  const routes: DeclaredRoute[] = [];
  for (const wrapper of discovery.getControllers()) {
    const controller = wrapper.metatype as
      (new (...args: unknown[]) => unknown) | null;
    if (!controller) {
      throw new Error(`controller ${String(wrapper.name)} has no metatype`);
    }
    if (Reflect.getMetadata(VERSION_METADATA, controller) !== undefined) {
      throw new Error(
        `${controller.name}: versioned controllers are not modelled`,
      );
    }
    const basePath = singlePath(
      Reflect.getMetadata(PATH_METADATA, controller),
      controller.name,
    );
    const prototype = controller.prototype as Record<string, unknown>;
    for (const methodName of scanner.getAllMethodNames(prototype)) {
      const handler = prototype[methodName] as object;
      const requestMethod = Reflect.getMetadata(METHOD_METADATA, handler) as
        RequestMethod | undefined;
      if (requestMethod === undefined) continue;
      const owner = `${controller.name}.${methodName}`;
      const method = RequestMethod[requestMethod];
      if (!SUPPORTED_METHODS.has(method)) {
        throw new Error(`${owner}: unsupported request method ${method}`);
      }
      if (Reflect.getMetadata(VERSION_METADATA, handler) !== undefined) {
        throw new Error(`${owner}: versioned handlers are not modelled`);
      }
      const path = singlePath(
        Reflect.getMetadata(PATH_METADATA, handler),
        owner,
      );
      routes.push({
        declaredOn: declaringClass(prototype, methodName),
        guards: [
          ...((Reflect.getMetadata(GUARDS_METADATA, controller) as
            unknown[] | undefined) ?? []),
          ...((Reflect.getMetadata(GUARDS_METADATA, handler) as
            unknown[] | undefined) ?? []),
        ],
        key: routeKey(method, `${basePath}/${path}`),
        owner,
        roles: reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
          handler as () => unknown,
          controller,
        ]),
      });
    }
  }
  return routes;
}

interface ExpressLayer {
  route?: { path: string; methods: Record<string, boolean> };
}

// Registered inventory: the Express route layers that actually serve
// requests. Middleware mounts (Apollo `/graphql`, CORS, body parsers,
// static assets) carry no `route` and are out of scope (suite header).
// Deliberately coupled to Express 5's internal `app.router.stack` (5.2.1
// via @nestjs/platform-express 11); a shape change fails here by name.
export function collectRegisteredRoutes(app: INestApplication): string[] {
  const instance = app.getHttpAdapter().getInstance() as {
    router?: { stack?: unknown };
  };
  const stack = instance.router?.stack;
  if (!Array.isArray(stack)) {
    throw new Error(
      'collectRegisteredRoutes: expected Express 5 `app.router.stack` to be an array; ' +
        'the Express router shape changed, so update this reader',
    );
  }
  return (stack as ExpressLayer[]).flatMap((layer) =>
    layer.route
      ? Object.keys(layer.route.methods).map((method) =>
          routeKey(method, layer.route!.path),
        )
      : [],
  );
}
