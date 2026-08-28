import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const MODULES_ROOT = join(__dirname, '../../../modules');

const DEFAULT_SORTS: Array<{
  collection: string;
  entityFile: string;
  dtoFile: string;
  fields: string[];
}> = [
  {
    collection: 'bookings',
    entityFile: 'bookings/infrastructure/persistence/booking.entity.ts',
    dtoFile: 'bookings/presentation/graphql/booking.dto.ts',
    fields: ['scheduledAt', 'id'],
  },
  {
    collection: 'jobs',
    entityFile: 'jobs/infrastructure/persistence/cleaning-job.entity.ts',
    dtoFile: 'jobs/presentation/graphql/cleaning-job.type.ts',
    fields: ['scheduledAt', 'id'],
  },
  {
    collection: 'property.bookings',
    entityFile: 'bookings/infrastructure/persistence/booking.entity.ts',
    dtoFile: 'bookings/presentation/graphql/booking.dto.ts',
    fields: ['scheduledAt', 'id'],
  },
  {
    collection: 'checklist.items',
    entityFile: 'jobs/infrastructure/persistence/checklist-item.entity.ts',
    dtoFile: 'jobs/presentation/graphql/checklist-item.type.ts',
    fields: ['position', 'id'],
  },
  {
    collection: 'customers',
    entityFile: 'customers/infrastructure/persistence/customer.entity.ts',
    dtoFile: 'customers/presentation/graphql/customer.type.ts',
    fields: ['createdAt', 'id'],
  },
  {
    collection: 'customer.properties',
    entityFile: 'customers/infrastructure/persistence/property.entity.ts',
    dtoFile: 'customers/presentation/graphql/property.type.ts',
    fields: ['createdAt', 'id'],
  },
  {
    collection: 'customerProperties',
    entityFile: 'customers/infrastructure/persistence/property.entity.ts',
    dtoFile: 'customers/presentation/graphql/property.type.ts',
    fields: ['createdAt', 'id'],
  },
  {
    collection: 'cleaners',
    entityFile: 'cleaners/infrastructure/persistence/cleaner.entity.ts',
    dtoFile: 'cleaners/presentation/graphql/cleaner.type.ts',
    fields: ['createdAt', 'id'],
  },
  {
    collection: 'teams',
    entityFile: 'cleaners/infrastructure/persistence/team.entity.ts',
    dtoFile: 'cleaners/presentation/graphql/team.type.ts',
    fields: ['createdAt', 'id'],
  },
  {
    collection: 'team.cleaners',
    entityFile: 'cleaners/infrastructure/persistence/cleaner.entity.ts',
    dtoFile: 'cleaners/presentation/graphql/cleaner.type.ts',
    fields: ['createdAt', 'id'],
  },
  {
    collection: 'services',
    entityFile: 'catalog/infrastructure/persistence/service.entity.ts',
    dtoFile: 'catalog/presentation/graphql/service.type.ts',
    fields: ['createdAt', 'id'],
  },
  {
    collection: 'addOns',
    entityFile: 'catalog/infrastructure/persistence/add-on.entity.ts',
    dtoFile: 'catalog/presentation/graphql/add-on.type.ts',
    fields: ['createdAt', 'id'],
  },
];

function walkTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walkTsFiles(full));
    } else if (full.endsWith('.ts') && !full.endsWith('.spec.ts')) {
      files.push(full);
    }
  }
  return files;
}

function decoratorBlocks(src: string, name: string): string[] {
  const blocks: string[] = [];
  const marker = `@${name}(`;
  let from = 0;
  while (from < src.length) {
    const start = src.indexOf(marker, from);
    if (start === -1) {
      break;
    }
    let i = start + marker.length;
    let depth = 1;
    while (i < src.length && depth > 0) {
      if (src[i] === '(') {
        depth += 1;
      } else if (src[i] === ')') {
        depth -= 1;
      }
      i += 1;
    }
    blocks.push(src.slice(start, i));
    from = i;
  }
  return blocks;
}

function graphqlPresentationFiles(): string[] {
  const files: string[] = [];
  for (const moduleName of readdirSync(MODULES_ROOT)) {
    const graphqlDir = join(
      MODULES_ROOT,
      moduleName,
      'presentation',
      'graphql',
    );
    try {
      if (statSync(graphqlDir).isDirectory()) {
        files.push(...walkTsFiles(graphqlDir));
      }
    } catch {
      // module has no GraphQL presentation folder
    }
  }
  return files;
}

describe('paginated collection allowlist (Task 8 source/config)', () => {
  it('does not leave collection surfaces on library cursor/10/50/-1', () => {
    for (const file of graphqlPresentationFiles()) {
      const src = readFileSync(file, 'utf8');
      if (
        !src.includes('PagingStrategies') &&
        !src.includes('defaultResultSize') &&
        !src.includes('maxResultsSize')
      ) {
        continue;
      }
      expect(src).not.toMatch(/PagingStrategies\.CURSOR/);
      expect(src).not.toMatch(/PagingStrategies\.NONE/);
      expect(src).not.toMatch(/defaultResultSize:\s*10\b/);
      expect(src).not.toMatch(/maxResultsSize:\s*50\b/);
      expect(src).not.toMatch(/maxResultsSize:\s*-1/);
      expect(src).toMatch(/defaultResultSize:\s*PLATFORM_PAGE_DEFAULT/);
      expect(src).toMatch(/maxResultsSize:\s*PLATFORM_PAGE_MAX/);
    }
  });

  it('enables totalCount on root many ReadResolvers and disables it on OffsetConnections', () => {
    for (const file of graphqlPresentationFiles()) {
      const src = readFileSync(file, 'utf8');
      if (/many:\s*\{\s*name:/.test(src)) {
        expect(src).toMatch(/enableTotalCount:\s*true/);
      }
      for (const block of decoratorBlocks(src, 'OffsetConnection')) {
        expect(block).toMatch(/enableTotalCount:\s*false/);
      }
    }
  });

  it('keeps default-sort columns on the entity and sortable on the DTO', () => {
    for (const row of DEFAULT_SORTS) {
      const entitySrc = readFileSync(join(MODULES_ROOT, row.entityFile), 'utf8');
      const dtoSrc = readFileSync(join(MODULES_ROOT, row.dtoFile), 'utf8');
      for (const field of row.fields) {
        expect(entitySrc).toMatch(new RegExp(`\\b${field}!:`));
        if (field === 'id') {
          expect(dtoSrc).toMatch(/@IDField/);
          expect(dtoSrc).toMatch(/\bid!:/);
        } else {
          expect(dtoSrc).toMatch(/@FilterableField/);
          expect(dtoSrc).toMatch(new RegExp(`\\b${field}!:`));
        }
      }
    }
  });
});
