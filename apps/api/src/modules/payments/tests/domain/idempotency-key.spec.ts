import { isCanonicalUuid } from '../../domain/idempotency-key';

describe('isCanonicalUuid', () => {
  it.each([
    '5f0c7a8e-1b2c-4d3e-8f90-a1b2c3d4e5f6',
    '5F0C7A8E-1B2C-4D3E-8F90-A1B2C3D4E5F6',
    '00000000-0000-0000-0001-000000000001',
  ])('accepts %s', (value) => {
    expect(isCanonicalUuid(value)).toBe(true);
  });

  it.each([
    '',
    'not-a-uuid',
    '5f0c7a8e1b2c4d3e8f90a1b2c3d4e5f6',
    '5f0c7a8e-1b2c-4d3e-8f90-a1b2c3d4e5f',
    '5f0c7a8e-1b2c-4d3e-8f90-a1b2c3d4e5fg',
    ' 5f0c7a8e-1b2c-4d3e-8f90-a1b2c3d4e5f6 ',
  ])('rejects %j', (value) => {
    expect(isCanonicalUuid(value)).toBe(false);
  });
});
