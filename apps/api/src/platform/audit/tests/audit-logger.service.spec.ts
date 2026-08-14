import { Logger } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import { AuditEventEntity } from '../infrastructure/persistence/audit-event.entity';
import {
  AuditLoggerService,
  runAuditInTransaction,
} from '../infrastructure/audit-logger.service';

describe('AuditLoggerService', () => {
  let service: AuditLoggerService;
  let repository: { create: jest.Mock; save: jest.Mock };
  let logger: { error: jest.Mock; log: jest.Mock; warn: jest.Mock };

  beforeEach(async () => {
    repository = {
      create: jest.fn((data: Partial<AuditEventEntity>) => data),
      save: jest.fn(),
    };
    logger = { error: jest.fn(), log: jest.fn(), warn: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLoggerService,
        {
          provide: getRepositoryToken(AuditEventEntity),
          useValue: repository,
        },
        { provide: Logger, useValue: logger },
      ],
    }).compile();

    service = module.get<AuditLoggerService>(AuditLoggerService);
  });

  it('persists a row matching the event shape, including nullable fields, when the repository succeeds', async () => {
    repository.save.mockResolvedValue(undefined);

    await service.log({
      actorId: null,
      action: 'admin.login.failed',
      entityType: null,
      entityId: null,
      metadata: { email: 'x@example.com', reason: 'invalid_credentials' },
    });

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: null,
        action: 'admin.login.failed',
        entityType: null,
        entityId: null,
        metadata: { email: 'x@example.com', reason: 'invalid_credentials' },
      }),
    );
  });

  it('swallows a persistence failure outside an ambient transaction and reports it to the logger', async () => {
    const failure = new Error('db unavailable');
    repository.save.mockRejectedValue(failure);

    await expect(
      service.log({
        actorId: 'admin-1',
        action: 'admin.login.succeeded',
        entityType: 'AdminUser',
        entityId: 'admin-1',
      }),
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalled();
  });

  it('propagates a persistence failure when called inside an ambient transaction, without touching the injected repository', async () => {
    const failure = new Error('db unavailable');
    const managerMock = { save: jest.fn().mockRejectedValue(failure) };
    const manager = managerMock as unknown as EntityManager;

    await expect(
      runAuditInTransaction(manager, () =>
        service.log({
          actorId: 'owner-1',
          action: 'admin.created',
          entityType: 'AdminUser',
          entityId: 'new-admin-1',
          metadata: { role: 'SCHEDULER' },
        }),
      ),
    ).rejects.toThrow('db unavailable');

    expect(managerMock.save).toHaveBeenCalledWith(
      AuditEventEntity,
      expect.objectContaining({
        action: 'admin.created',
        entityType: 'AdminUser',
        entityId: 'new-admin-1',
      }),
    );
    expect(repository.save).not.toHaveBeenCalled();
  });
});
