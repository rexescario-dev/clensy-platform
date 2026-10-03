import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
} from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import { GraphQLObjectType, GraphQLSchema } from 'graphql';
import { AdminScope } from '../../../../platform/auth/domain/admin-scope';
import { Role } from '../../../../platform/auth/domain/role';
import type { TenantLabelOverridesService } from '../../application/services/tenant-label-overrides.service';
import { RELABELABLE_ROLES } from '../../domain/tenant-label-overrides';
import { AdminResolver } from '../../presentation/graphql/admin.resolver';
import { CurrentAdminLabelOverridesResolver } from '../../presentation/graphql/current-admin-label-overrides.resolver';
import type { CurrentAdminType } from '../../presentation/graphql/current-admin.type';

const UNSET = {
  ANALYST: null,
  CUSTOMER_SUPPORT: null,
  FINANCE: null,
  OPS_MANAGER: null,
  SCHEDULER: null,
  TENANT_OWNER: null,
};

describe('CurrentAdmin.tenantLabelOverrides', () => {
  describe('schema (spec §4.3)', () => {
    let schema: GraphQLSchema;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [GraphQLSchemaBuilderModule],
      }).compile();
      schema = await moduleRef
        .get(GraphQLSchemaFactory)
        .create([AdminResolver, CurrentAdminLabelOverridesResolver]);
    });

    // Owns only the new field. The rest of CurrentAdmin's field set is
    // pinned by admin.resolver.spec.ts.
    it('adds a nullable tenantLabelOverrides field with no arguments to CurrentAdmin', () => {
      const fields = (
        schema.getType('CurrentAdmin') as GraphQLObjectType
      ).getFields();
      expect(fields.tenantLabelOverrides).toBeDefined();
      expect(String(fields.tenantLabelOverrides.type)).toBe(
        'TenantLabelOverrides',
      );
      expect(fields.tenantLabelOverrides.args).toEqual([]);
    });

    it('types TenantLabelOverrides as { locale: String!, roles: RoleLabelOverrides! }', () => {
      const fields = (
        schema.getType('TenantLabelOverrides') as GraphQLObjectType
      ).getFields();
      expect(Object.keys(fields).sort()).toEqual(['locale', 'roles']);
      expect(String(fields.locale.type)).toBe('String!');
      expect(String(fields.roles.type)).toBe('RoleLabelOverrides!');
    });

    it('declares exactly one nullable String field per relabelable role (drift)', () => {
      const fields = (
        schema.getType('RoleLabelOverrides') as GraphQLObjectType
      ).getFields();
      expect(Object.keys(fields).sort()).toEqual([...RELABELABLE_ROLES].sort());
      for (const field of Object.values(fields)) {
        expect(String(field.type)).toBe('String');
      }
    });
  });

  describe('resolution (spec §4.3, §4.7 items 1–2)', () => {
    const labelsFor = jest.fn();
    const resolver = new CurrentAdminLabelOverridesResolver({
      labelsFor,
    } as unknown as TenantLabelOverridesService);
    const tenantAdmin: CurrentAdminType = {
      id: 'admin-1',
      tenantId: 'tenant-1',
      role: Role.FINANCE,
      scope: AdminScope.TENANT,
    };

    beforeEach(() => labelsFor.mockReset());

    it('returns null for PLATFORM scope without reading any tenant', async () => {
      await expect(
        resolver.tenantLabelOverrides({
          id: 'super-1',
          tenantId: null,
          role: Role.SUPER_ADMIN,
          scope: AdminScope.PLATFORM,
        }),
      ).resolves.toBeNull();
      expect(labelsFor).not.toHaveBeenCalled();
    });

    it("reads only the parent principal's tenant and maps kept labels, others null", async () => {
      labelsFor.mockResolvedValue({ FINANCE: 'Billing' });
      await expect(resolver.tenantLabelOverrides(tenantAdmin)).resolves.toEqual(
        { locale: 'en', roles: { ...UNSET, FINANCE: 'Billing' } },
      );
      expect(labelsFor).toHaveBeenCalledWith('tenant-1');
    });

    it('returns null when the service keeps nothing', async () => {
      labelsFor.mockResolvedValue(null);
      await expect(
        resolver.tenantLabelOverrides(tenantAdmin),
      ).resolves.toBeNull();
    });
  });
});
