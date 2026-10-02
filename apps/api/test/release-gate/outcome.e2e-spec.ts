import { classifyGraphql, classifyRest, normalizeOutcome } from './outcome';

// Pure tests of #92's outcome contract (decision 8). No app, no database.
describe('release-gate outcome classifier (#92)', () => {
  const uuid = '3f1c2a4e-9b7d-4c1a-8e2f-0a1b2c3d4e5f';

  it('classifies GraphQL authentication and role failures by status or code', () => {
    expect(
      classifyGraphql(
        {
          data: null,
          errors: [
            {
              extensions: { code: 'UNAUTHENTICATED' },
              message: 'Unauthorized',
            },
          ],
        },
        'customers',
      ),
    ).toEqual({ kind: 'UNAUTHENTICATED' });
    expect(
      classifyGraphql(
        {
          data: null,
          errors: [
            {
              extensions: {
                code: 'FORBIDDEN',
                originalError: { statusCode: 403 },
              },
              message: 'Forbidden resource',
            },
          ],
        },
        'customers',
      ),
    ).toEqual({ kind: 'FORBIDDEN' });
  });

  it('treats a code that disagrees with the status as UNEXPECTED', () => {
    expect(
      classifyGraphql(
        {
          data: null,
          errors: [
            { extensions: { code: 'FORBIDDEN', status: 404 }, message: 'x' },
          ],
        },
        'customer',
      ).kind,
    ).toBe('UNEXPECTED');
  });

  it('classifies a 4xx GraphQL error with its status and message', () => {
    expect(
      classifyGraphql(
        {
          data: null,
          errors: [
            {
              extensions: { originalError: { statusCode: 404 } },
              message: `Customer ${uuid} not found`,
            },
          ],
        },
        'updateCustomer',
      ),
    ).toEqual({
      kind: 'ERROR',
      message: `Customer ${uuid} not found`,
      status: 404,
    });
  });

  it('treats 5xx, validation errors, several errors and partial data as UNEXPECTED', () => {
    const cases: unknown[] = [
      {
        data: null,
        errors: [
          { extensions: { code: 'INTERNAL_SERVER_ERROR' }, message: 'boom' },
        ],
      },
      {
        errors: [
          {
            extensions: { code: 'GRAPHQL_VALIDATION_FAILED' },
            message: 'Cannot query field',
          },
        ],
      },
      {
        data: null,
        errors: [
          { extensions: { status: 404 }, message: 'a' },
          { extensions: { status: 404 }, message: 'b' },
        ],
      },
      {
        data: { customer: { id: uuid } },
        errors: [{ extensions: { status: 404 }, message: 'a' }],
      },
      { data: {} },
    ];
    for (const body of cases) {
      expect(classifyGraphql(body, 'customer').kind).toBe('UNEXPECTED');
    }
  });

  it('extracts ids from an object, a connection and an array; null is NULL', () => {
    expect(
      classifyGraphql({ data: { customer: { id: uuid } } }, 'customer'),
    ).toEqual({ ids: [uuid], kind: 'OK', totalCount: null });
    expect(
      classifyGraphql(
        { data: { customers: { nodes: [{ id: uuid }], totalCount: 1 } } },
        'customers',
      ),
    ).toEqual({ ids: [uuid], kind: 'OK', totalCount: 1 });
    expect(
      classifyGraphql({ data: { admins: [{ id: uuid }] } }, 'admins'),
    ).toEqual({ ids: [uuid], kind: 'OK', totalCount: null });
    expect(classifyGraphql({ data: { customer: null } }, 'customer')).toEqual({
      kind: 'NULL',
    });
  });

  it('classifies REST responses by status', () => {
    expect(classifyRest(401, {})).toEqual({ kind: 'UNAUTHENTICATED' });
    expect(classifyRest(403, {})).toEqual({ kind: 'FORBIDDEN' });
    expect(classifyRest(404, { message: `Booking ${uuid} not found` })).toEqual(
      { kind: 'ERROR', message: `Booking ${uuid} not found`, status: 404 },
    );
    expect(classifyRest(200, [{ id: uuid }])).toEqual({
      ids: [uuid],
      kind: 'OK',
      totalCount: null,
    });
    expect(classifyRest(500, {}).kind).toBe('UNEXPECTED');
  });

  it('normalizes UUIDs so a foreign id and a never-existed id compare equal', () => {
    const foreign = classifyGraphql(
      {
        data: null,
        errors: [
          {
            extensions: { status: 404 },
            message: `Customer ${uuid} not found`,
          },
        ],
      },
      'x',
    );
    const control = classifyGraphql(
      {
        data: null,
        errors: [
          {
            extensions: { status: 404 },
            message: 'Customer 00000000-0000-4000-8000-000000000000 not found',
          },
        ],
      },
      'x',
    );
    expect(normalizeOutcome(foreign)).toBe(normalizeOutcome(control));
  });
});
