import { AdminScope } from '../../auth/domain/admin-scope';
import {
  InvalidAuditTagsError,
  principalAuditTags,
  tenantAuditTags,
} from '../application/audit-tags';

describe('audit tags (multi-tenant spec §4.6; #90 decision 4)', () => {
  describe('tenantAuditTags', () => {
    it('tags the given tenant with TENANT scope', () => {
      expect(tenantAuditTags('tenant-1')).toEqual({
        scope: AdminScope.TENANT,
        tenantId: 'tenant-1',
      });
    });

    it.each(['', '   '])('rejects a blank tenant id (%j)', (tenantId) => {
      expect(() => tenantAuditTags(tenantId)).toThrow(InvalidAuditTagsError);
    });

    it('rejects a non-string tenant id smuggled past the type system', () => {
      expect(() => tenantAuditTags(null as unknown as string)).toThrow(
        InvalidAuditTagsError,
      );
    });
  });

  describe('principalAuditTags', () => {
    it('maps a tenant principal to tenant tags', () => {
      expect(
        principalAuditTags({ scope: AdminScope.TENANT, tenantId: 'tenant-1' }),
      ).toEqual({ scope: AdminScope.TENANT, tenantId: 'tenant-1' });
    });

    it('maps a platform principal to PLATFORM + null tenant', () => {
      expect(
        principalAuditTags({ scope: AdminScope.PLATFORM, tenantId: null }),
      ).toEqual({ scope: AdminScope.PLATFORM, tenantId: null });
    });

    it.each([
      ['TENANT without a tenant', AdminScope.TENANT, null],
      ['TENANT with a blank tenant', AdminScope.TENANT, ' '],
      ['PLATFORM with a tenant', AdminScope.PLATFORM, 'tenant-1'],
      ['an unknown scope with a tenant', 'UNKNOWN', 'tenant-1'],
      ['an unknown scope without a tenant', 'UNKNOWN', null],
    ])('rejects %s instead of guessing', (_label, scope, tenantId) => {
      expect(() =>
        principalAuditTags({ scope: scope as AdminScope, tenantId }),
      ).toThrow(InvalidAuditTagsError);
    });
  });
});
