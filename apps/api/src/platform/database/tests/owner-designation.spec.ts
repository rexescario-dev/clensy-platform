import {
  OwnerDesignationError,
  validateOwnerDesignations,
} from '../owner-designation';

// Multi-tenant spec §4.3 / §4.7: every existing `OWNER` must be explicitly
// designated `SUPER_ADMIN` or `TENANT_OWNER`; anything less aborts the
// migration before the role enum loses `OWNER`.
describe('validateOwnerDesignations', () => {
  it('throws when an OWNER row has no designation', () => {
    expect(() =>
      validateOwnerDesignations(
        ['a', 'b'],
        [{ adminUserId: 'a', role: 'TENANT_OWNER' }],
      ),
    ).toThrow(OwnerDesignationError);
    expect(() =>
      validateOwnerDesignations(
        ['a', 'b'],
        [{ adminUserId: 'a', role: 'TENANT_OWNER' }],
      ),
    ).toThrow(/b/);
  });

  it('returns the designation per OWNER id when the designations are complete', () => {
    const result = validateOwnerDesignations(
      ['a', 'b'],
      [
        { adminUserId: 'a', role: 'TENANT_OWNER' },
        { adminUserId: 'b', role: 'SUPER_ADMIN' },
      ],
    );

    expect(result).toEqual(
      new Map([
        ['a', 'TENANT_OWNER'],
        ['b', 'SUPER_ADMIN'],
      ]),
    );
  });

  it('throws when a designation names an id that is not an existing OWNER', () => {
    expect(() =>
      validateOwnerDesignations(
        ['a'],
        [
          { adminUserId: 'a', role: 'TENANT_OWNER' },
          { adminUserId: 'z', role: 'SUPER_ADMIN' },
        ],
      ),
    ).toThrow(/z/);
  });

  it('throws when the same OWNER id is designated more than once', () => {
    expect(() =>
      validateOwnerDesignations(
        ['a'],
        [
          { adminUserId: 'a', role: 'TENANT_OWNER' },
          { adminUserId: 'a', role: 'TENANT_OWNER' },
        ],
      ),
    ).toThrow(OwnerDesignationError);
  });

  it.each(['OWNER', 'OPS_MANAGER', 'tenant_owner', ''])(
    'throws for an invalid designation value %p',
    (role) => {
      expect(() =>
        validateOwnerDesignations(['a'], [{ adminUserId: 'a', role }]),
      ).toThrow(OwnerDesignationError);
    },
  );

  it('accepts an empty designation list when there are no OWNER rows', () => {
    expect(validateOwnerDesignations([], [])).toEqual(new Map());
  });

  it('reports every problem at once rather than only the first', () => {
    let error: unknown;
    try {
      validateOwnerDesignations(
        ['a', 'b'],
        [
          { adminUserId: 'a', role: 'OWNER' },
          { adminUserId: 'z', role: 'SUPER_ADMIN' },
        ],
      );
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(OwnerDesignationError);
    expect((error as OwnerDesignationError).problems).toHaveLength(3);
  });
});
