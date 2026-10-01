import { MODULE_METADATA } from '@nestjs/common/constants';

// #91 decision 2: GraphiQL is the only public HTTP route, and only outside
// production. `graphql.module.ts` decides at import time, so each case
// loads it in isolation under the NODE_ENV being tested.
function controllersFor(nodeEnv: string): unknown[] {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;
  try {
    let controllers: unknown[] = [];
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { GraphqlModule } = require('../graphql.module') as {
        GraphqlModule: object;
      };
      controllers = Reflect.getMetadata(
        MODULE_METADATA.CONTROLLERS,
        GraphqlModule,
      ) as unknown[];
    });
    return controllers;
  } finally {
    process.env.NODE_ENV = previous;
  }
}

describe('GraphqlModule GraphiQL registration', () => {
  it('registers no controller in production', () => {
    expect(controllersFor('production')).toEqual([]);
  });

  it('registers GraphiqlController outside production', () => {
    const controllers = controllersFor('test');
    expect(controllers).toHaveLength(1);
    expect((controllers[0] as { name: string }).name).toBe(
      'GraphiqlController',
    );
  });
});
