import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AUDIT_LOGGER } from '../../../../platform/audit/application/audit-logger.port';
import type { AuditLogger } from '../../../../platform/audit/application/audit-logger.port';
import { runAuditInTransaction } from '../../../../platform/audit/infrastructure/audit-logger.service';
import { Customer } from '../../domain/customer';
import { CustomerEntity } from '../../infrastructure/persistence/customer.entity';
import { CreateCustomerCommand } from '../commands/create-customer.command';
import { UpdateCustomerCommand } from '../commands/update-customer.command';

@Injectable()
export class CustomersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CustomerEntity)
    private readonly customerRepository: Repository<CustomerEntity>,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  // Opens its own transaction and wraps the work in `runAuditInTransaction`
  // (mirroring `AdminsService.create` exactly, spec §4.4/Admin Foundation
  // §4.6's transactional-audit rule): the entity write goes through the
  // transaction's own `manager`, and the `auditLogger.log()` call made
  // inside `fn` automatically detects the ambient transaction and uses that
  // same `manager`, so a persistence failure there rolls back the
  // `CustomerEntity` insert with it.
  create(command: CreateCustomerCommand): Promise<Customer> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const entity = manager.create(CustomerEntity, {
          fullName: command.fullName,
          email: command.email,
          phone: command.phone,
          notes: command.notes ?? null,
        });

        this.assertValid(entity);
        await manager.save(entity);

        await this.auditLogger.log({
          actorId: command.actorId,
          action: 'customer.create',
          entityType: 'customer',
          entityId: entity.id,
        });

        return entity;
      }),
    );
  }

  update(id: string, command: UpdateCustomerCommand): Promise<Customer> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const entity = await manager.findOneBy(CustomerEntity, { id });
        if (!entity) {
          throw new NotFoundException(`Customer ${id} not found`);
        }

        // Safe because `command` is constructed by the resolver via spread
        // (spec §4.2) — it only carries keys the caller actually provided,
        // so an omitted field retains its current value and a provided
        // field (including `notes: null`) is applied. `actorId` is
        // destructured out first — it's part of the command (needed for
        // the audit call below) but not a `Customer` field, and merging it
        // in would leak a stray `actorId` property onto the returned
        // entity.
        const { actorId, ...fields } = command;
        void actorId; // consumed via `command.actorId` in the audit call below
        Object.assign(entity, fields);

        this.assertValid(entity);
        await manager.save(entity);

        await this.auditLogger.log({
          actorId: command.actorId,
          action: 'customer.update',
          entityType: 'customer',
          entityId: entity.id,
        });

        return entity;
      }),
    );
  }

  getCustomer(id: string): Promise<Customer | null> {
    return this.customerRepository.findOneBy({ id });
  }

  listCustomers(): Promise<Customer[]> {
    return this.customerRepository.find();
  }

  // Application-layer validation (spec §4.7): the domain invariant for
  // `email` is non-empty only — syntax validation is a presentation-layer
  // concern owned by the GraphQL input types, not this service.
  private assertValid(
    customer: Pick<Customer, 'fullName' | 'email' | 'phone'>,
  ): void {
    if (!customer.fullName?.trim()) {
      throw new BadRequestException('fullName must not be empty');
    }
    if (!customer.email?.trim()) {
      throw new BadRequestException('email must not be empty');
    }
    if (!customer.phone?.trim()) {
      throw new BadRequestException('phone must not be empty');
    }
  }
}
