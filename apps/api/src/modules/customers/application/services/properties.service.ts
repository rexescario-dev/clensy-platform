import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AUDIT_LOGGER } from '../../../../platform/audit/application/audit-logger.port';
import type { AuditLogger } from '../../../../platform/audit/application/audit-logger.port';
import { runAuditInTransaction } from '../../../../platform/audit/infrastructure/audit-logger.service';
import { Property } from '../../domain/property';
import { CustomerEntity } from '../../infrastructure/persistence/customer.entity';
import { PropertyEntity } from '../../infrastructure/persistence/property.entity';
import { CreatePropertyCommand } from '../commands/create-property.command';
import { UpdatePropertyCommand } from '../commands/update-property.command';

@Injectable()
export class PropertiesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(PropertyEntity)
    private readonly propertyRepository: Repository<PropertyEntity>,
    @InjectRepository(CustomerEntity)
    private readonly customerRepository: Repository<CustomerEntity>,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  // Mirrors `CustomersService.create` exactly (transaction +
  // `runAuditInTransaction`, spec §4.4). The `customerId` existence check
  // (spec §4.7) happens inside the same transaction, before the
  // `PropertyEntity` is built/saved, via the transaction's own `manager` —
  // not the injected `customerRepository`, which is reserved for read-only
  // paths (`listCustomerProperties`).
  create(command: CreatePropertyCommand): Promise<Property> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const customer = await manager.findOneBy(CustomerEntity, {
          id: command.customerId,
        });
        if (!customer) {
          throw new NotFoundException(
            `Customer ${command.customerId} not found`,
          );
        }

        const entity = manager.create(PropertyEntity, {
          customerId: command.customerId,
          label: command.label,
          addressLine1: command.addressLine1,
          addressLine2: command.addressLine2 ?? null,
          city: command.city,
          region: command.region,
          postalCode: command.postalCode,
          accessNotes: command.accessNotes ?? null,
        });

        this.assertValid(entity);
        await manager.save(entity);

        await this.auditLogger.log({
          actorId: command.actorId,
          action: 'property.create',
          entityType: 'property',
          entityId: entity.id,
        });

        return entity;
      }),
    );
  }

  update(id: string, command: UpdatePropertyCommand): Promise<Property> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const entity = await manager.findOneBy(PropertyEntity, { id });
        if (!entity) {
          throw new NotFoundException(`Property ${id} not found`);
        }

        // Same safety as `CustomersService.update`: `command` is built by
        // the resolver via spread, so it only carries keys the caller
        // actually provided. `actorId` is destructured out first — it's
        // part of the command (needed for the audit call below) but not a
        // `Property` field, and merging it in would leak a stray `actorId`
        // property onto the returned entity.
        const { actorId, ...fields } = command;
        void actorId; // consumed via `command.actorId` in the audit call below
        Object.assign(entity, fields);

        this.assertValid(entity);
        await manager.save(entity);

        await this.auditLogger.log({
          actorId: command.actorId,
          action: 'property.update',
          entityType: 'property',
          entityId: entity.id,
        });

        return entity;
      }),
    );
  }

  getProperty(id: string): Promise<Property | null> {
    return this.propertyRepository.findOneBy({ id });
  }

  // Guards a query explicitly scoped to a single customer (spec §4.2):
  // silently returning `[]` for a typo'd/stale `customerId` would be
  // indistinguishable from "this customer genuinely has no properties," so
  // a nonexistent `customerId` is surfaced as `NotFoundException` instead.
  // This is a read path, so it uses the injected `customerRepository`
  // directly rather than opening a transaction.
  async listCustomerProperties(customerId: string): Promise<Property[]> {
    const customer = await this.customerRepository.findOneBy({
      id: customerId,
    });
    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }

    return this.propertyRepository.findBy({ customerId });
  }

  // Bulk lookup for Bookings' GraphQL relation-batching loader (Bookings
  // spec §4.5); deliberately not exposed over GraphQL directly. Returns
  // exactly the rows that exist for the given ids — no synthetic entries
  // for missing ones, the caller's loader handles gaps.
  getPropertiesByIds(ids: string[]): Promise<Property[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.propertyRepository.findBy({ id: In(ids) });
  }

  // Application-layer validation (spec §4.7), run on the merged entity
  // state (post `Object.assign` in `update`), not the raw incoming command.
  private assertValid(
    property: Pick<
      Property,
      'label' | 'addressLine1' | 'city' | 'region' | 'postalCode'
    >,
  ): void {
    if (!property.label?.trim()) {
      throw new BadRequestException('label must not be empty');
    }
    if (!property.addressLine1?.trim()) {
      throw new BadRequestException('addressLine1 must not be empty');
    }
    if (!property.city?.trim()) {
      throw new BadRequestException('city must not be empty');
    }
    if (!property.region?.trim()) {
      throw new BadRequestException('region must not be empty');
    }
    if (!property.postalCode?.trim()) {
      throw new BadRequestException('postalCode must not be empty');
    }
  }
}
