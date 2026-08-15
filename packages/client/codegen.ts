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
      plugins: ['typescript', 'typescript-operations', 'typescript-react-apollo'],
      config: {
        withHooks: true,
      },
    },
  },
  ignoreNoDocuments: true,
};

export default config;
