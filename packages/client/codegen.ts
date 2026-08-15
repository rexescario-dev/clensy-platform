import type { CodegenConfig } from '@graphql-codegen/cli';

// Points at apps/api's generated schema (Task 5's autoSchemaFile output —
// see apps/api/src/platform/graphql/graphql.module.ts). Regenerate with
// `pnpm --filter @clensy/client codegen` after the schema or any
// `src/**/*.graphql` operation document changes.
const config: CodegenConfig = {
  schema: '../../apps/api/src/schema.gql',
  documents: ['src/**/*.graphql'],
  generates: {
    'src/generated/graphql.ts': {
      // No base `typescript` plugin: `typescript-operations` already emits
      // self-contained declarations (Scalars/Enum/Input types) for
      // whatever the operation documents actually use — adding `typescript`
      // on top would redeclare those same identifiers (e.g. `Role`,
      // `CreateAdminInput`) a second time in this single output file,
      // producing TS2300 duplicate-identifier errors.
      plugins: ['typescript-operations', 'typescript-react-apollo'],
      config: {
        withHooks: true,
      },
    },
  },
  ignoreNoDocuments: true,
};

export default config;
