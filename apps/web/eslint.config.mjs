// @ts-check
import { contextforgeJavascript } from '../../tooling/eslint.contextforge.mjs';
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['.next/**', 'node_modules/**'] },
  ...contextforgeJavascript({ eslint, tseslint }),
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    // `lib/i18n-rendering.test.tsx` and `lib/app-i18n-boundary.test.tsx` are
    // the deliberate exceptions outside `i18n/**`: they render through the
    // real getMessages() -> NextIntlClientProvider path (i18n spec §6; single
    // app i18n provider spec §6.2) and must import getMessages directly.
    ignores: ['i18n/**', 'lib/i18n-rendering.test.tsx', 'lib/app-i18n-boundary.test.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/messages/*', '**/messages/**'],
              message:
                'Do not import message catalogs directly. Use useTranslations()/getTranslations() instead.',
            },
            {
              group: ['**/i18n/messages', '**/i18n/messages.ts'],
              message:
                'getMessages() is internal to the i18n loading boundary. Use useTranslations()/getTranslations() instead.',
            },
          ],
        },
      ],
    },
  },
);
